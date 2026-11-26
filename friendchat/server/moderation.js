// ─────────────────────────────────────────────────────────────
//  Modération automatique
//   1. Antispam : limite de débit (seau de jetons), messages en double,
//      trop de mentions → avertissement puis mute automatique progressif.
//   2. Anti-insultes : les insultes sont masquées (c*****d), avec une liste
//      d'exceptions (mots autorisés) que les admins gèrent via /filtre.
//  Les administrateurs ne sont jamais mutés automatiquement.
// ─────────────────────────────────────────────────────────────

const { db } = require('./db');

// ─── Réglages ────────────────────────────────────────────────
const MSG_BUCKET = { capacity: 5, refillMs: 1500 };     // 5 messages d'affilée, puis 1 toutes les 1,5 s
const ACTION_BUCKET = { capacity: 12, refillMs: 400 };  // réactions, votes, modifications…
const DUPLICATE_WINDOW_MS = 30 * 1000;                   // 3e message identique en 30 s = refusé
const MAX_MENTIONS = 5;
const SPAM_STRIKES_TO_MUTE = 3;                          // 3 avertissements en 1 min → mute
const SPAM_STRIKE_WINDOW_MS = 60 * 1000;
const INSULT_STRIKES_TO_MUTE = 3;                        // 3 messages censurés en 10 min → mute
const INSULT_STRIKE_WINDOW_MS = 10 * 60 * 1000;
const MUTE_STEPS_MIN = [2, 5, 15, 60];                   // durées successives des mutes automatiques
const MUTE_HISTORY_MS = 24 * 60 * 60 * 1000;

// ─── État en mémoire par utilisateur ─────────────────────────
const state = new Map(); // userId -> { buckets, recent, spamStrikes, insultStrikes, autoMutes }
function st(userId) {
  if (!state.has(userId)) state.set(userId, { buckets: {}, recent: [], spamStrikes: [], insultStrikes: [], autoMutes: [] });
  return state.get(userId);
}

function takeToken(userId, kind, cfg) {
  const s = st(userId);
  const now = Date.now();
  const b = s.buckets[kind] || (s.buckets[kind] = { tokens: cfg.capacity, at: now });
  b.tokens = Math.min(cfg.capacity, b.tokens + (now - b.at) / cfg.refillMs);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

const recentOnly = (arr, windowMs) => arr.filter(t => Date.now() - t < windowMs);

async function autoMute(io, user, reason) {
  const s = st(user.id);
  s.autoMutes = recentOnly(s.autoMutes, MUTE_HISTORY_MS);
  const minutes = MUTE_STEPS_MIN[Math.min(s.autoMutes.length, MUTE_STEPS_MIN.length - 1)];
  s.autoMutes.push(Date.now());
  s.spamStrikes = [];
  s.insultStrikes = [];
  const muteUntil = Date.now() + minutes * 60 * 1000;
  await db.users.update({ id: user.id }, { $set: { muted: true, muteUntil } });
  io.to(`user-${user.id}`).emit('account_muted', { until: muteUntil, reason, auto: true });
  io.to('admin-room').emit('system_message', { content: `🛡️ ${user.username} a été rendu muet automatiquement ${minutes} min (${reason}).` });
  return minutes;
}

/**
 * Antispam pour un message texte (global, privé ou commande).
 * Renvoie { ok: true } ou { ok: false, message } (le message est déjà refusé).
 */
async function checkSpam(io, user, content) {
  if (user.role === 'admin') return { ok: true };
  const s = st(user.id);
  const now = Date.now();
  let problem = null;

  if (!takeToken(user.id, 'msg', MSG_BUCKET)) problem = '🐢 Doucement : tu envoies trop de messages à la suite.';

  const norm = (content || '').toLowerCase().replace(/\s+/g, ' ').trim();
  s.recent = s.recent.filter(r => now - r.at < DUPLICATE_WINDOW_MS);
  if (!problem && norm && s.recent.filter(r => r.text === norm).length >= 2) problem = '🔁 Message en double : évite de répéter la même chose.';

  const mentions = (content || '').match(/(^|\s)@[A-Za-z0-9_]{3,20}/g) || [];
  if (!problem && mentions.length > MAX_MENTIONS) problem = `📣 Trop de mentions dans un seul message (max ${MAX_MENTIONS}).`;

  if (!problem) {
    s.recent.push({ text: norm, at: now });
    return { ok: true };
  }

  s.spamStrikes = recentOnly(s.spamStrikes, SPAM_STRIKE_WINDOW_MS);
  s.spamStrikes.push(now);
  if (s.spamStrikes.length >= SPAM_STRIKES_TO_MUTE) {
    const minutes = await autoMute(io, user, 'spam');
    return { ok: false, message: `🔇 Spam détecté : tu es muet(te) pendant ${minutes} min.` };
  }
  return { ok: false, message: `${problem} (avertissement ${s.spamStrikes.length}/${SPAM_STRIKES_TO_MUTE - 1})` };
}

/** Limite douce pour les petites actions (réactions, votes, éditions). Pas de mute. */
function allowAction(user) {
  if (user.role === 'admin') return true;
  return takeToken(user.id, 'action', ACTION_BUCKET);
}

// ─── Anti-insultes ───────────────────────────────────────────

// Mots écrits « normalement » : chaque lettre peut être répétée (« connnnard »)
// et on accepte les terminaisons e / s / es / x (féminin, pluriel).
const DEFAULT_WORDS = [
  // français
  'con', 'conne', 'connard', 'connarde', 'connasse', 'salope', 'salaud', 'pute', 'pouffiasse', 'grognasse',
  'encule', 'enculer', 'enculeur', 'enfoire', 'batard', 'abruti', 'cretin', 'debile', 'imbecile', 'mongol', 'golmon',
  'triso', 'trisomique', 'pede', 'pd', 'tapette', 'tafiole', 'gouine', 'negre', 'bougnoule', 'youpin',
  'bicot', 'fdp', 'ntm', 'tg', 'merdeux', 'boloss', 'bolosse', 'cassos', 'chienne',
  // anglais
  'fuck', 'fucker', 'fucking', 'motherfucker', 'bitch', 'asshole', 'cunt', 'nigger', 'nigga', 'faggot', 'fag',
  'whore', 'slut', 'bastard', 'dickhead',
];
const DEFAULT_PHRASES = [
  'nique ta mere', 'nique ta race', 'ta gueule', 'ferme ta gueule', 'va te faire foutre', 'fils de pute',
  'trou du cul', 'sac a merde', 'tete de con',
];
// Mots légitimes qui ressemblent à une insulte une fois normalisés
const DEFAULT_EXCEPTIONS = ['cone', 'cones'];

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '€': 'e' };

function normWord(w) {
  return w.toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[013457@$€]/g, c => LEET[c])
    .replace(/[^a-z]/g, '');
}

function wordRegex(word) {
  const letters = normWord(word).split('').map(l => `${l}+`).join('');
  return new RegExp(`^${letters}(e|s|es|x)?$`);
}

const filterConfig = { enabled: true, words: [], exceptions: [], removed: [] }; // personnalisations admin
let compiled = null;

function compile() {
  const words = [...DEFAULT_WORDS.filter(w => !filterConfig.removed.includes(w)), ...filterConfig.words];
  const phrases = DEFAULT_PHRASES.filter(p => !filterConfig.removed.includes(p))
    .concat(filterConfig.words.filter(w => w.includes(' ')));
  compiled = {
    single: words.filter(w => !w.includes(' ')).map(wordRegex),
    phrases: phrases.map(p => p.split(' ').map(wordRegex)),
    exceptions: new Set([...DEFAULT_EXCEPTIONS, ...filterConfig.exceptions].map(normWord)),
  };
}
compile();

async function loadFilterConfig() {
  const row = await db.settings.findOne({ key: 'filter' });
  if (row) Object.assign(filterConfig, { enabled: row.enabled !== false, words: row.words || [], exceptions: row.exceptions || [], removed: row.removed || [] });
  compile();
}

async function saveFilterConfig() {
  compile();
  await db.settings.update({ key: 'filter' }, { key: 'filter', ...filterConfig }, { upsert: true });
}

const mask = (w) => {
  const chars = Array.from(w);
  return chars[0] + '*'.repeat(Math.max(1, chars.length - 1));
};

/** Masque les insultes. Renvoie { text, hits } (hits = nombre de mots masqués). */
function censor(text) {
  if (!filterConfig.enabled || !text) return { text, hits: 0 };
  // Mots = suites de lettres/chiffres/symboles leet, sans toucher aux URLs ni aux @mentions
  const tokens = [];
  const re = /https?:\/\/\S+|@[A-Za-z0-9_]+|[\p{L}\p{N}$€@]+(?:['’][\p{L}]+)?/gu;
  let m;
  while ((m = re.exec(text))) {
    if (m[0].startsWith('http') || m[0].startsWith('@')) continue;
    const parts = m[0].split(/['’]/);             // « t'es » → on teste aussi « es », « l'abruti » → « abruti »
    let offset = m.index;
    for (const p of parts) {
      if (p) tokens.push({ raw: p, start: offset, end: offset + p.length, norm: normWord(p) });
      offset += p.length + 1;
    }
  }
  const hit = new Set();
  tokens.forEach((t, i) => {
    if (!t.norm || compiled.exceptions.has(t.norm)) return;
    if (compiled.single.some(r => r.test(t.norm))) hit.add(i);
  });
  compiled.phrases.forEach(phrase => {
    for (let i = 0; i + phrase.length <= tokens.length; i++) {
      if (phrase.every((r, k) => r.test(tokens[i + k].norm))) for (let k = 0; k < phrase.length; k++) hit.add(i + k);
    }
  });
  if (!hit.size) return { text, hits: 0 };
  let out = '';
  let last = 0;
  [...hit].sort((a, b) => a - b).forEach(i => {
    const t = tokens[i];
    out += text.slice(last, t.start) + mask(t.raw);
    last = t.end;
  });
  return { text: out + text.slice(last), hits: hit.size };
}

/**
 * Filtre un texte envoyé par un membre : masque, avertit, compte les récidives.
 * Renvoie le texte (éventuellement masqué).
 */
async function filterUserText(io, socket, user, text) {
  const { text: clean, hits } = censor(text);
  if (!hits) return clean;
  if (user.role === 'admin') return clean;
  const s = st(user.id);
  s.insultStrikes = recentOnly(s.insultStrikes, INSULT_STRIKE_WINDOW_MS);
  s.insultStrikes.push(Date.now());
  if (s.insultStrikes.length >= INSULT_STRIKES_TO_MUTE) {
    const minutes = await autoMute(io, user, 'insultes');
    socket.emit('system_message', { content: `🔇 Trop d'insultes : tu es muet(te) pendant ${minutes} min.` });
  } else {
    socket.emit('system_message', { content: `🧼 Langage : ton message a été censuré (avertissement ${s.insultStrikes.length}/${INSULT_STRIKES_TO_MUTE - 1}).` });
  }
  return clean;
}

// ─── Commande admin /filtre ──────────────────────────────────
//  /filtre liste | on | off
//  /filtre ajouter <mot ou expression>   → nouvelle insulte à masquer
//  /filtre retirer <mot>                 → ne plus masquer ce mot
//  /filtre autoriser <mot>               → exception (mot jamais masqué)
//  /filtre interdire <mot>               → retire une exception
//  /filtre test <texte>                  → montre ce qui serait masqué
async function handleFilterCommand(argStr, socket) {
  const reply = (content) => socket.emit('system_message', { content });
  const [sub, ...restWords] = argStr.split(/\s+/);
  const rest = restWords.join(' ').trim().toLowerCase();
  const key = rest.split(' ').map(normWord).filter(Boolean).join(' ');

  switch ((sub || 'liste').toLowerCase()) {
    case 'liste': case 'list': {
      const words = [...DEFAULT_WORDS, ...DEFAULT_PHRASES].filter(w => !filterConfig.removed.includes(w)).concat(filterConfig.words);
      reply(`🧼 Filtre anti-insultes : **${filterConfig.enabled ? 'activé' : 'désactivé'}**\n` +
        `Mots ajoutés : ${filterConfig.words.join(', ') || '—'}\n` +
        `Mots retirés : ${filterConfig.removed.join(', ') || '—'}\n` +
        `Exceptions (toujours autorisés) : ${[...DEFAULT_EXCEPTIONS, ...filterConfig.exceptions].join(', ')}\n` +
        `${words.length} mots/expressions surveillés.\n` +
        'Commandes : /filtre ajouter | retirer | autoriser | interdire <mot>, /filtre test <texte>, /filtre on|off');
      return;
    }
    case 'on': case 'off':
      filterConfig.enabled = sub.toLowerCase() === 'on';
      await saveFilterConfig();
      reply(`🧼 Filtre anti-insultes ${filterConfig.enabled ? 'activé' : 'désactivé'}.`);
      return;
    case 'test':
      reply(`Résultat : ${censor(restWords.join(' ')).text || '(vide)'}`);
      return;
  }
  if (!key) { reply('Précise un mot. Ex : /filtre autoriser con'); return; }

  switch (sub.toLowerCase()) {
    case 'ajouter':
      filterConfig.removed = filterConfig.removed.filter(w => w !== key);
      filterConfig.exceptions = filterConfig.exceptions.filter(w => w !== key);
      if (![...DEFAULT_WORDS, ...DEFAULT_PHRASES].includes(key) && !filterConfig.words.includes(key)) filterConfig.words.push(key);
      await saveFilterConfig();
      reply(`🧼 « ${key} » sera maintenant masqué.`);
      return;
    case 'retirer':
      filterConfig.words = filterConfig.words.filter(w => w !== key);
      if ([...DEFAULT_WORDS, ...DEFAULT_PHRASES].includes(key) && !filterConfig.removed.includes(key)) filterConfig.removed.push(key);
      await saveFilterConfig();
      reply(`🧼 « ${key} » n'est plus filtré.`);
      return;
    case 'autoriser': case 'exception':
      if (!filterConfig.exceptions.includes(key)) filterConfig.exceptions.push(key);
      await saveFilterConfig();
      reply(`✅ « ${key} » est une exception : il ne sera jamais masqué.`);
      return;
    case 'interdire':
      filterConfig.exceptions = filterConfig.exceptions.filter(w => w !== key);
      await saveFilterConfig();
      reply(`🚫 « ${key} » n'est plus une exception.`);
      return;
    default:
      reply('Usage : /filtre liste | ajouter | retirer | autoriser | interdire <mot> | test <texte> | on | off');
  }
}

module.exports = { checkSpam, allowAction, censor, filterUserText, loadFilterConfig, handleFilterCommand };
