// ─────────────────────────────────────────────────────────────
//  Jeu « /rimbaud » — complète le vers !
//
//  Une partie à la fois, partagée par tout le chat global :
//   - on affiche le début d'un poème et le début d'un vers,
//   - le premier qui complète correctement le vers gagne des points,
//   - indices (un mot révélé à chaque fois, -1 point, un seul par joueur
//     sauf pour le créateur de la partie), minuteur,
//   - le lanceur peut choisir lui-même le poème et le mot de coupure
//     (dans ce cas il ne peut pas répondre : il connaît la réponse).
// ─────────────────────────────────────────────────────────────

const { v4: uuidv4 } = require('uuid');
const POEMS = require('./rimbaud-poems');
const { db } = require('./db');

const DEFAULT_DURATION = 120;          // secondes
const ALLOWED_DURATIONS = [60, 90, 120, 180, 300];
const CONTEXT_LINES = 8;               // vers affichés avant la coupure
const BASE_POINTS = 3;
const ANSWER_COOLDOWN_MS = 700;

// ─── Texte ───────────────────────────────────────────────────

// Découpe un vers en mots ; la ponctuation isolée (« — », « ! », « : »…)
// reste collée au mot voisin pour qu'on ne coupe jamais sur un signe seul.
const OPENERS = /^[«“(—–-]+$/;
function tokenize(verse) {
  const raw = verse.split(/\s+/).filter(Boolean);
  const words = [];
  let pending = '';                                   // « ou — en attente du mot suivant
  for (const tok of raw) {
    const hasLetters = /[\p{L}\p{N}]/u.test(tok);
    if (hasLetters) { words.push(pending ? `${pending} ${tok}` : tok); pending = ''; }
    else if (OPENERS.test(tok) || !words.length) pending = pending ? `${pending} ${tok}` : tok;
    else words[words.length - 1] += ' ' + tok;        // : ; ! ? » … collés au mot précédent
  }
  if (pending) {
    if (words.length) words[words.length - 1] += ' ' + pending; else words.push(pending);
  }
  return words;
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function similarity(a, b) {
  if (!a && !b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

// Un mot est « bon » s'il est identique ou à une petite faute de frappe près.
// Les mots courts doivent être exacts (« a » ≠ « à » ne compte pas : les accents sont déjà retirés).
function wordOk(guess, target) {
  if (guess === target) return true;
  const tol = target.length <= 3 ? 0 : target.length <= 6 ? 1 : 2;
  return levenshtein(guess, target) <= tol;
}

// Distance « en mots » entre la proposition et la réponse : chaque mot faux,
// manquant ou en trop coûte 1 (0,5 pour un petit mot de 1-2 lettres oublié/ajouté).
function wordDistance(guess, target) {
  const g = guess ? guess.split(' ') : [];
  const t = target ? target.split(' ') : [];
  const gap = (w) => (w.length <= 2 ? 0.5 : 1);
  let prev = [0];
  for (let j = 1; j <= t.length; j++) prev[j] = prev[j - 1] + gap(t[j - 1]);
  for (let i = 1; i <= g.length; i++) {
    const cur = [prev[0] + gap(g[i - 1])];
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(
        prev[j] + gap(g[i - 1]),
        cur[j - 1] + gap(t[j - 1]),
        prev[j - 1] + (wordOk(g[i - 1], t[j - 1]) ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[t.length];
}

// Bonne réponse : tous les mots justes (fautes de frappe tolérées) ;
// pour un long morceau (6 mots ou plus), on pardonne un petit mot oublié.
function isCorrect(guess, target) {
  const nWords = target.split(' ').length;
  return wordDistance(guess, target) <= (nWords >= 6 ? 0.5 : 0);
}

function flatten(poem) {
  const lines = [];
  poem.stanzas.forEach((stanza, s) => stanza.forEach((text, i) => lines.push({ text, newStanza: i === 0 && s > 0 })));
  return lines;
}

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Pour le sélecteur côté client : les vers déjà découpés en mots (même découpage que le jeu)
function publicPoemList() {
  return POEMS.map(p => ({
    id: p.id, title: p.title, date: p.date,
    lines: flatten(p).map(l => ({ ...l, words: tokenize(l.text) })),
  }));
}

function findPoem(query) {
  if (!query) return null;
  const q = normalize(query).replace(/ /g, '');
  return POEMS.find(p => p.id.replace(/-/g, '') === q)
    || POEMS.find(p => normalize(p.title).replace(/ /g, '').includes(q))
    || POEMS.find(p => p.id.replace(/-/g, '').startsWith(q));
}

// ─── Partie ──────────────────────────────────────────────────

let game = null;
const lastAnswerAt = new Map();

function buildGame({ poem, line, shown, duration, starter, chosen }) {
  const lines = flatten(poem);
  const target = lines[line];
  const words = tokenize(target.text);
  const from = Math.max(0, line - CONTEXT_LINES);
  return {
    id: uuidv4(),
    poem, line, words, shown,
    hidden: words.slice(shown),
    context: lines.slice(from, line),
    truncated: from > 0,
    hints: 0,
    hintUsers: [],               // qui a déjà demandé son indice (1 par personne, sauf le créateur)
    starter: { id: starter.id, username: starter.username },
    chosen,
    startedAt: Date.now(),
    endsAt: Date.now() + duration * 1000,
    duration,
    status: 'playing',
    winner: null,
    timer: null,
  };
}

function publicState(g) {
  if (!g) return null;
  const finished = g.status !== 'playing';
  return {
    id: g.id,
    poemTitle: g.poem.title,
    poemDate: g.poem.date,
    verseNumber: g.line + 1,
    context: g.context,
    truncated: g.truncated,
    prefix: g.words.slice(0, g.shown).join(' '),
    hiddenCount: g.hidden.length,
    hintWords: g.hidden.slice(0, g.hints),
    hintsBy: g.hintUsers.map(u => u.username),
    points: Math.max(1, BASE_POINTS - g.hints),
    startedBy: g.starter.username,
    starterId: g.starter.id,
    chosen: g.chosen,
    startedAt: g.startedAt,
    endsAt: g.endsAt,
    duration: g.duration,
    status: g.status,
    winner: g.winner,
    answer: finished ? g.hidden.join(' ') : null,
    fullVerse: finished ? g.words.join(' ') : null,
  };
}

function systemPost(io, senderName, content) {
  io.to('global').emit('new_global_message', {
    id: `sys-${uuidv4()}`, room: 'global', sender_id: 'system',
    sender_name: senderName, content, type: 'text', created_at: Date.now(), avatar: null,
  });
}

function broadcast(io) {
  io.emit('rimbaud_state', publicState(game));
}

function finish(io, status, winner = null) {
  if (!game || game.status !== 'playing') return;
  clearTimeout(game.timer);
  game.status = status;
  game.winner = winner;
  broadcast(io);
  const verse = game.words.join(' ');
  if (status === 'won') {
    systemPost(io, '🪶 Rimbaud', `🏆 **${winner.username}** a complété le vers (+${winner.points} pt${winner.points > 1 ? 's' : ''}) !\n> ${verse}\n— *${game.poem.title}*`);
  } else {
    systemPost(io, '🪶 Rimbaud', `${status === 'timeout' ? '⏰ Temps écoulé' : '🏳️ Partie arrêtée'} ! Il fallait trouver :\n> ${verse}\n— *${game.poem.title}*`);
  }
  game = null;
}

/**
 * Démarre une partie.
 * opts: { poemId?, line? (index 0-based), shown? (nb de mots affichés), duration? }
 * Renvoie { error } ou { ok: true }.
 */
function startGame(io, user, opts = {}) {
  if (game) return { error: `Une partie est déjà en cours (lancée par ${game.starter.username}). Termine-la d'abord !` };

  const chosen = !!opts.poemId;
  const poem = chosen ? findPoem(opts.poemId) : POEMS[Math.floor(Math.random() * POEMS.length)];
  if (!poem) return { error: `Poème introuvable : « ${opts.poemId} ». Tape /rimbaud liste pour voir les poèmes.` };

  const lines = flatten(poem);
  let line = opts.line;
  if (line === undefined || line === null || Number.isNaN(line)) line = randInt(1, lines.length - 1);
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) return { error: `« ${poem.title} » a ${lines.length} vers : choisis un numéro entre 1 et ${lines.length}.` };

  const words = tokenize(lines[line].text);
  let shown = opts.shown;
  if (shown === undefined || shown === null || Number.isNaN(shown)) {
    shown = words.length <= 2 ? Math.min(1, words.length - 1) : randInt(1, Math.max(1, Math.floor(words.length / 2)));
  }
  if (!Number.isInteger(shown) || shown < 0 || shown >= words.length) return { error: `Ce vers a ${words.length} mots : tu peux en montrer entre 0 et ${words.length - 1}.` };

  const duration = ALLOWED_DURATIONS.includes(opts.duration) ? opts.duration : DEFAULT_DURATION;
  game = buildGame({ poem, line, shown, duration, starter: user, chosen });
  game.timer = setTimeout(() => finish(io, 'timeout'), duration * 1000);
  broadcast(io);
  systemPost(io, '🪶 Rimbaud',
    `**${user.username}** lance une partie : complète le vers de *${poem.title}* ! ` +
    `Réponds dans le panneau du jeu ou directement dans le chat (${duration} s).`);
  return { ok: true };
}

/** Vérifie une proposition. Renvoie { ok, closeness, message } ; gère la victoire. */
function checkAnswer(io, user, text, { silent = false } = {}) {
  if (!game || game.status !== 'playing') return { ok: false, message: 'Aucune partie en cours.' };
  if (game.chosen && user.id === game.starter.id) return { ok: false, message: 'Tu as choisi le vers, tu connais déjà la réponse 😉' };

  const now = Date.now();
  if (!silent && now - (lastAnswerAt.get(user.id) || 0) < ANSWER_COOLDOWN_MS) return { ok: false, message: 'Doucement… une proposition à la fois.' };
  lastAnswerAt.set(user.id, now);

  let guess = normalize(text);
  if (!guess) return { ok: false, message: 'Écris la fin du vers.' };
  // Tolère qu'on recopie le début du vers déjà affiché
  const prefix = normalize(game.words.slice(0, game.shown).join(' '));
  if (prefix && guess.startsWith(prefix + ' ')) guess = guess.slice(prefix.length + 1);

  const target = normalize(game.hidden.join(' '));
  // Tolère aussi qu'on n'écrive que la partie non révélée par les indices
  const afterHints = normalize(game.hidden.slice(game.hints).join(' '));
  const sim = Math.max(similarity(guess, target), game.hints ? similarity(guess, afterHints) : 0);
  const ok = isCorrect(guess, target) || (game.hints > 0 && !!afterHints && isCorrect(guess, afterHints));

  if (ok) {
    const points = Math.max(1, BASE_POINTS - game.hints);
    addPoints(user, points).catch(err => console.error('[rimbaud] score', err.message));
    finish(io, 'won', { id: user.id, username: user.username, points });
    return { ok: true, closeness: 1, message: `Bravo ! +${points} point${points > 1 ? 's' : ''} 🏆` };
  }
  const message = sim >= 0.65 ? 'Tu chauffes 🔥 — presque !' : sim >= 0.4 ? 'Pas loin… 🤔' : 'Non, ce n’est pas ça ❌';
  return { ok: false, closeness: Math.round(sim * 100), message };
}

function giveHint(io, user) {
  if (!game || game.status !== 'playing') return { error: 'Aucune partie en cours.' };
  if (game.hints >= game.hidden.length - 1) return { error: 'Plus d’indice possible : il ne reste qu’un mot à trouver !' };
  const isStarter = user.id === game.starter.id;
  if (!isStarter && game.hintUsers.some(u => u.id === user.id)) {
    return { error: 'Tu as déjà utilisé ton indice pour cette partie (un seul par personne).' };
  }
  game.hints += 1;
  if (!isStarter) game.hintUsers.push({ id: user.id, username: user.username });
  broadcast(io);
  return { ok: true, message: `💡 ${user.username} a demandé un indice.` };
}

function stopGame(io, user) {
  if (!game) return { error: 'Aucune partie en cours.' };
  if (user.id !== game.starter.id && user.role !== 'admin') return { error: 'Seul le lanceur de la partie (ou un admin) peut l’arrêter.' };
  finish(io, 'stopped');
  return { ok: true };
}

// ─── Scores ──────────────────────────────────────────────────

async function addPoints(user, points) {
  const existing = await db.scores.findOne({ userId: user.id });
  if (existing) {
    await db.scores.update({ userId: user.id }, { $inc: { points, wins: 1 }, $set: { username: user.username, updatedAt: Date.now() } });
  } else {
    await db.scores.insert({ userId: user.id, username: user.username, points, wins: 1, updatedAt: Date.now() });
  }
}

async function leaderboard(limit = 10) {
  const rows = await db.scores.find({}).sort({ points: -1, wins: -1 }).limit(limit);
  return rows.map(r => ({ username: r.username, points: r.points, wins: r.wins }));
}

// ─── Commande texte /rimbaud ─────────────────────────────────
//  /rimbaud                      → vers au hasard
//  /rimbaud liste                → liste des poèmes
//  /rimbaud <poème> [vers] [mots]→ partie choisie (vers 1-based, mots = nb de mots affichés)
//  /rimbaud indice | stop        → indice / arrêt
//  (/rimbaud choisir ouvre le sélecteur visuel côté client)

function handleRimbaudCommand(args, user, io, socket) {
  const sub = (args[0] || '').toLowerCase();
  const reply = (content) => socket.emit('system_message', { content });

  if (!sub) {
    const r = startGame(io, user);
    if (r.error) reply(r.error);
    return;
  }
  if (sub === 'liste' || sub === 'list') {
    reply(`Poèmes disponibles (${POEMS.length}) : ` + POEMS.map(p => p.id).join(', ') +
      '\n\nExemple : /rimbaud dormeur 7 3 → 7e vers du Dormeur du val, 3 premiers mots affichés.\nOu /rimbaud choisir pour cliquer directement sur le mot.');
    return;
  }
  if (sub === 'indice' || sub === 'hint') {
    const r = giveHint(io, user);
    if (r.error) reply(r.error);
    return;
  }
  if (sub === 'stop' || sub === 'abandon') {
    const r = stopGame(io, user);
    if (r.error) reply(r.error);
    return;
  }
  if (sub === 'choisir') { reply('Le sélecteur s’ouvre depuis la barre de message : tape /rimbaud choisir puis Entrée.'); return; }

  const line = args[1] !== undefined ? parseInt(args[1], 10) - 1 : undefined;
  const shown = args[2] !== undefined ? parseInt(args[2], 10) : undefined;
  if ((args[1] !== undefined && Number.isNaN(line)) || (args[2] !== undefined && Number.isNaN(shown))) {
    reply('Usage : /rimbaud <poème> [n° du vers] [nb de mots affichés]');
    return;
  }
  const r = startGame(io, user, { poemId: sub, line, shown });
  if (r.error) reply(r.error);
}

// ─── Branchement Socket.io ───────────────────────────────────

function attachSocket(io, socket, user) {
  socket.emit('rimbaud_state', publicState(game));

  socket.on('rimbaud_get_state', () => socket.emit('rimbaud_state', publicState(game)));

  socket.on('rimbaud_start', (opts = {}) => {
    const r = startGame(io, user, {
      poemId: typeof opts.poemId === 'string' ? opts.poemId : undefined,
      line: Number.isInteger(opts.line) ? opts.line : undefined,
      shown: Number.isInteger(opts.shown) ? opts.shown : undefined,
      duration: Number(opts.duration) || undefined,
    });
    if (r.error) socket.emit('rimbaud_feedback', { ok: false, message: r.error });
  });

  socket.on('rimbaud_answer', ({ text } = {}) => {
    if (typeof text !== 'string' || text.length > 300) return;
    socket.emit('rimbaud_feedback', checkAnswer(io, user, text));
  });

  socket.on('rimbaud_hint', () => {
    const r = giveHint(io, user);
    if (r.error) socket.emit('rimbaud_feedback', { ok: false, message: r.error });
    else io.emit('rimbaud_feedback', { ok: false, info: true, message: r.message });
  });

  socket.on('rimbaud_stop', () => {
    const r = stopGame(io, user);
    if (r.error) socket.emit('rimbaud_feedback', { ok: false, message: r.error });
  });
}

/** Appelé pour chaque message normal du chat global : une bonne réponse dans le chat gagne aussi. */
function checkChatMessage(io, user, content) {
  if (!game || game.status !== 'playing') return;
  if (game.chosen && user.id === game.starter.id) return;
  const res = checkAnswer(io, user, content, { silent: true });
  if (res.ok) io.to(`user-${user.id}`).emit('rimbaud_feedback', res);
}

module.exports = {
  handleRimbaudCommand, attachSocket, checkChatMessage, leaderboard, publicPoemList,
  // exportés pour les tests
  _internals: { tokenize, normalize, similarity, findPoem, flatten, isCorrect },
};
