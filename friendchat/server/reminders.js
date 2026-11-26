// ─────────────────────────────────────────────────────────────
//  Rappels (/rappel)
//   /rappel 10m Sortir le linge     /rappel 2h30 Appeler maman
//   /rappel 18:30 Partie de Rimbaud /rappel demain 9h Dentiste
//   /rappels                        /rappel annuler 2
//  Le rappel arrive en notification ; si tu n'es pas connecté à ce
//  moment-là, il t'attend à ta prochaine connexion.
// ─────────────────────────────────────────────────────────────

const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');
const { censor } = require('./moderation');

const MAX_PENDING = 20;
const MAX_DELAY_MS = 30 * 24 * 60 * 60 * 1000;
const TZ = process.env.TZ_REMINDERS || 'Europe/Paris';
const timers = new Map();
let ioRef = null;

// Décalage (ms) du fuseau des membres par rapport à UTC à un instant donné
function tzOffsetMs(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(date).reduce((o, p) => (o[p.type] = p.value, o), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Heure locale (fuseau des membres) → timestamp. dayOffset : 0 aujourd'hui, 1 demain. */
function localTime(h, m, dayOffset, now = Date.now()) {
  const off = tzOffsetMs(new Date(now));
  const local = new Date(now + off);
  const target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset, h, m) - off;
  return target;
}

/**
 * Analyse le début du texte :
 *   délai  : « 10m », « 15 minutes », « dans 2h », « 1h30 », « 3j »
 *   heure  : « 18:30 », « 18h », « 18h30 », « à 9h », « demain 9h », « demain 14:15 »
 *   Règle : « Xh » / « XhYY » avec X < 6 est un délai (« 2h »), sinon une heure du jour (« 18h »).
 * Renvoie { at, text } ou { error }.
 */
function parseReminder(argStr, now = Date.now()) {
  let rest = argStr.trim();
  let at = null;
  let m;
  const eat = (re) => { const r = re.exec(rest); if (r) rest = rest.slice(r[0].length); return r; };

  eat(/^dans\s+/i);
  const tomorrow = !!eat(/^demain\s+/i);
  const explicitAt = !!eat(/^à\s+/i);
  const clock = (h, min) => {
    if (h > 23 || min > 59) return null;
    let t = localTime(h, min, tomorrow ? 1 : 0, now);
    if (!tomorrow && t <= now) t = localTime(h, min, 1, now);
    return t;
  };

  if ((m = eat(/^(\d+)\s*(?:minutes?|mins?|mn|m)(?=\s|$)\s*/i))) at = now + +m[1] * 60000;
  else if ((m = eat(/^(\d+)\s*(?:jours?|j|d)(?=\s|$)\s*/i))) at = now + +m[1] * 86400000;
  else if ((m = eat(/^(\d{1,2}):(\d{2})(?=\s|$)\s*/))) at = clock(+m[1], +m[2]);
  else if ((m = eat(/^(\d{1,3})\s*h(?:eures?)?\s*(\d{2})?(?=\s|$)\s*/i))) {
    const h = +m[1], min = m[2] ? +m[2] : 0;
    at = (tomorrow || explicitAt || h >= 6) && h <= 23 ? clock(h, min) : now + h * 3600000 + min * 60000;
  }
  if (!at) return { error: 'Format : /rappel 10m texte · /rappel 2h texte · /rappel 18:30 texte · /rappel demain 9h texte' };
  const text = rest.trim();
  if (!text) return { error: 'Écris aussi le texte du rappel. Ex : /rappel 10m Sortir le linge' };
  if (at - now > MAX_DELAY_MS) return { error: 'Un rappel ne peut pas dépasser 30 jours.' };
  if (at - now < 30000) return { error: 'Un rappel doit être dans au moins 1 minute.' };
  return { at, text: text.slice(0, 200) };
}

const fmt = (ts) => new Date(ts).toLocaleString('fr-FR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function deliver(r) {
  timers.delete(r.id);
  const room = ioRef && ioRef.sockets.adapter.rooms.get(`user-${r.userId}`);
  if (!room || !room.size) return; // hors ligne : livré à la prochaine connexion
  ioRef.to(`user-${r.userId}`).emit('reminder', { id: r.id, text: r.text, at: r.at });
  await db.reminders.update({ id: r.id }, { $set: { delivered: true } });
}

function schedule(r) {
  clearTimeout(timers.get(r.id));
  const delay = r.at - Date.now();
  if (delay <= 0) return deliver(r);
  // setTimeout est limité à ~24,8 jours : on se reprogramme si besoin
  timers.set(r.id, setTimeout(() => (r.at - Date.now() > 1000 ? schedule(r) : deliver(r)), Math.min(delay, 2 ** 31 - 1)));
}

async function init(io) {
  ioRef = io;
  const pending = await db.reminders.find({ delivered: { $ne: true } });
  pending.forEach(schedule);
}

/** À la connexion : rappels arrivés à échéance pendant l'absence. */
async function onConnect(socket, user) {
  const due = await db.reminders.find({ userId: user.id, delivered: { $ne: true }, at: { $lte: Date.now() } });
  for (const r of due) {
    socket.emit('reminder', { id: r.id, text: r.text, at: r.at, late: true });
    await db.reminders.update({ id: r.id }, { $set: { delivered: true } });
  }
}

async function handleReminderCommand(cmd, argStr, user, socket) {
  const reply = (content) => socket.emit('system_message', { content });
  const pending = (await db.reminders.find({ userId: user.id, delivered: { $ne: true } })).sort((a, b) => a.at - b.at);

  if (cmd === '/rappels' || /^liste$/i.test(argStr.trim())) {
    reply(pending.length ? 'Tes rappels :\n' + pending.map((r, i) => `${i + 1}. ${fmt(r.at)} : ${r.text}`).join('\n') + '\n(/rappel annuler <numéro>)' : 'Aucun rappel prévu. Ex : /rappel 10m Sortir le linge');
    return;
  }
  const cancel = /^(annuler|supprimer)\s+(\d+)$/i.exec(argStr.trim());
  if (cancel) {
    const r = pending[+cancel[2] - 1];
    if (!r) return reply('Numéro de rappel inconnu. Tape /rappels pour la liste.');
    clearTimeout(timers.get(r.id)); timers.delete(r.id);
    await db.reminders.remove({ id: r.id });
    return reply(`Rappel annulé : ${r.text}`);
  }
  if (pending.length >= MAX_PENDING) return reply(`Tu as déjà ${MAX_PENDING} rappels en attente.`);
  const parsed = parseReminder(argStr);
  if (parsed.error) return reply(parsed.error);
  const r = { id: uuidv4(), userId: user.id, text: censor(parsed.text).text, at: parsed.at, createdAt: Date.now(), delivered: false };
  await db.reminders.insert(r);
  schedule(r);
  reply(`Rappel enregistré pour ${fmt(r.at)} : ${r.text}`);
}

module.exports = { init, onConnect, handleReminderCommand, parseReminder };
