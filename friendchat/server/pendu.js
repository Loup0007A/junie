// ─────────────────────────────────────────────────────────────
//  Jeu du pendu collectif (/pendu)
//  Les mots viennent des poèmes de Rimbaud : l'indice est le titre du poème.
//  Tout le monde propose des lettres (ou le mot entier) ; 7 erreurs = pendu.
//  /pendu <mot> : on choisit soi-même le mot (on ne peut alors pas jouer).
// ─────────────────────────────────────────────────────────────

const { v4: uuidv4 } = require('uuid');
const POEMS = require('./rimbaud-poems');
const { censor } = require('./moderation');

const MAX_ERRORS = 7;
const DURATION_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 600;

const plain = (s) => s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Mots candidats : 6 à 12 lettres, sans majuscule (pas de noms propres), une seule fois par poème
const WORDS = [];
for (const p of POEMS) {
  const seen = new Set();
  for (const v of p.stanzas.flat()) {
    for (const w of v.match(/\p{L}+/gu) || []) {
      if (w !== w.toLowerCase()) continue;                       // noms propres et débuts de vers exclus
      const k = plain(w);
      if (k.length >= 6 && k.length <= 12 && /^[a-z]+$/.test(k) && !seen.has(k) && !censor(w).hits) {
        seen.add(k);
        WORDS.push({ word: w, poem: p.title });
      }
    }
  }
}

let game = null;
const lastGuess = new Map();

function publicState(g) {
  if (!g) return null;
  const finished = g.status !== 'playing';
  return {
    id: g.id,
    // Lettres découvertes, « _ » pour les autres ; tirets et apostrophes visibles
    pattern: Array.from(g.word).map(ch => {
      const letters = plain(ch).split('').filter(c => /[a-z]/.test(c));       // « œ » = o + e
      return letters.length && !finished && !letters.every(c => g.found.has(c)) ? '_' : ch;
    }),
    hint: g.hint,
    tried: [...g.tried].sort(),
    wrong: [...g.tried].filter(l => !plain(g.word).includes(l)).length,
    maxErrors: MAX_ERRORS,
    status: g.status,
    winner: g.winner,
    startedBy: g.starter.username,
    starterId: g.starter.id,
    chosen: g.chosen,
    endsAt: g.endsAt,
    word: finished ? g.word : null,
  };
}

function systemPost(io, content) {
  io.to('global').emit('new_global_message', {
    id: `sys-${uuidv4()}`, room: 'global', sender_id: 'system', sender_name: 'Pendu',
    content, type: 'text', created_at: Date.now(), avatar: null,
  });
}

function broadcast(io) { io.emit('pendu_state', publicState(game)); }

function finish(io, status, winner = null) {
  if (!game || game.status !== 'playing') return;
  clearTimeout(game.timer);
  game.status = status;
  game.winner = winner;
  broadcast(io);
  const word = `**${game.word}**`;
  systemPost(io, status === 'won'
    ? `${winner ? `**${winner}** a trouvé` : 'Trouvé'} : ${word} (${game.hint}).`
    : status === 'lost' ? `Pendu ! Le mot était ${word} (${game.hint}).`
      : `Partie de pendu terminée. Le mot était ${word}.`);
  game = null;
}

function start(io, user, customWord) {
  if (game) return { error: `Une partie de pendu est déjà en cours (lancée par ${game.starter.username}).` };
  let pick;
  if (customWord) {
    const w = customWord.trim().toLowerCase();
    if (!/^[a-zàâäçéèêëîïôöùûüÿœæ'-]{4,20}$/.test(w)) return { error: 'Le mot doit faire 4 à 20 lettres (accents, tiret et apostrophe acceptés).' };
    if (censor(w).hits) return { error: 'Ce mot n’est pas autorisé.' };
    pick = { word: w, poem: `mot choisi par ${user.username}` };
  } else {
    pick = WORDS[Math.floor(Math.random() * WORDS.length)];
  }
  game = {
    id: uuidv4(), word: pick.word, hint: customWord ? pick.poem : `dans « ${pick.poem} »`,
    found: new Set(), tried: new Set(), status: 'playing', winner: null,
    starter: { id: user.id, username: user.username }, chosen: !!customWord,
    endsAt: Date.now() + DURATION_MS,
  };
  game.timer = setTimeout(() => finish(io, 'timeout'), DURATION_MS);
  broadcast(io);
  systemPost(io, `**${user.username}** lance un pendu : ${Array.from(pick.word).filter(c => /[a-z]/.test(plain(c))).length} lettres, ${game.hint}. Ouvre le panneau du jeu pour proposer des lettres.`);
  return { ok: true };
}

/** Proposition d'une lettre ou du mot entier. */
function guess(io, user, raw) {
  if (!game || game.status !== 'playing') return { error: 'Aucune partie de pendu en cours.' };
  if (game.chosen && user.id === game.starter.id) return { error: 'Tu as choisi le mot : laisse les autres chercher.' };
  const now = Date.now();
  if (now - (lastGuess.get(user.id) || 0) < COOLDOWN_MS) return { error: 'Une proposition à la fois.' };
  lastGuess.set(user.id, now);

  const g = plain(String(raw || '').trim());
  const target = plain(game.word);
  if (/^[a-z]$/.test(g)) {
    if (game.tried.has(g)) return { error: `La lettre ${g.toUpperCase()} a déjà été proposée.` };
    game.tried.add(g);
    if (target.includes(g)) {
      game.found.add(g);
      const allFound = [...target].every(c => !/[a-z]/.test(c) || game.found.has(c));
      if (allFound) { finish(io, 'won', user.username); return { ok: true, message: 'Bravo, tu as complété le mot !' }; }
      broadcast(io);
      return { ok: true, message: `Oui, il y a un ${g.toUpperCase()}.` };
    }
    const wrong = [...game.tried].filter(l => !target.includes(l)).length;
    if (wrong >= MAX_ERRORS) { finish(io, 'lost'); return { ok: false, message: 'Pendu !' }; }
    broadcast(io);
    return { ok: false, message: `Pas de ${g.toUpperCase()}.` };
  }
  if (/^[a-z' -]{2,}$/.test(g)) {
    if (g.replace(/[' -]/g, '') === target.replace(/[' -]/g, '')) { finish(io, 'won', user.username); return { ok: true, message: 'Bravo, c’est le bon mot !' }; }
    // Un mot faux compte comme une erreur
    game.tried.add(`#${g.slice(0, 12)}`);
    const wrong = [...game.tried].filter(l => !target.includes(l)).length;
    if (wrong >= MAX_ERRORS) { finish(io, 'lost'); return { ok: false, message: 'Pendu !' }; }
    broadcast(io);
    return { ok: false, message: 'Ce n’est pas le mot (une erreur de plus).' };
  }
  return { error: 'Propose une lettre ou un mot.' };
}

function stop(io, user) {
  if (!game) return { error: 'Aucune partie de pendu en cours.' };
  if (user.id !== game.starter.id && user.role !== 'admin') return { error: 'Seul le lanceur (ou un admin) peut arrêter la partie.' };
  finish(io, 'stopped');
  return { ok: true };
}

/** /pendu, /pendu <mot>, /pendu stop */
function handlePenduCommand(argStr, user, io, socket) {
  const arg = argStr.trim();
  const r = arg.toLowerCase() === 'stop' ? stop(io, user) : start(io, user, arg || null);
  if (r.error) socket.emit('system_message', { content: r.error });
}

function attachSocket(io, socket, user) {
  socket.emit('pendu_state', publicState(game));
  socket.on('pendu_get_state', () => socket.emit('pendu_state', publicState(game)));
  socket.on('pendu_start', () => { const r = start(io, user, null); if (r.error) socket.emit('pendu_feedback', { ok: false, message: r.error }); });
  socket.on('pendu_guess', ({ text } = {}) => {
    if (typeof text !== 'string' || text.length > 40) return;
    const r = guess(io, user, text);
    socket.emit('pendu_feedback', r.error ? { ok: false, message: r.error } : r);
  });
  socket.on('pendu_stop', () => { const r = stop(io, user); if (r.error) socket.emit('pendu_feedback', { ok: false, message: r.error }); });
}

module.exports = { handlePenduCommand, attachSocket, _internals: { WORDS, plain } };
