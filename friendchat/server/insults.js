// ─────────────────────────────────────────────────────────────
//  Moteur anti-insultes
//
//  Le texte est d'abord « nettoyé » caractère par caractère, en gardant
//  la position d'origine de chaque caractère pour pouvoir masquer au bon endroit :
//   - casse ignorée (CoNnArD), accents retirés (débile → debile) ;
//   - caractères invisibles supprimés (espaces de largeur nulle, trait d'union conditionnel) ;
//   - caractères « déguisés » ramenés à l'alphabet latin : pleine chasse (ｃｏｎ),
//     lettres mathématiques (𝐜𝐨𝐧), lettres cyrilliques/grecques identiques (соnnаrd) ;
//   - leet speak (c0nn4rd, s@lope, 3ncul3) et lettres répétées (connnnnard).
//
//  Puis on cherche :
//   1. les mots interdits (avec féminin/pluriel), y compris avec une lettre masquée (c*nnard) ;
//   2. les mots écrits lettre par lettre (c o n n a r d, c.o.n.n.a.r.d) ou coupés
//      par de la ponctuation (sa-lope, con.nard) ;
//   3. les insultes « fortes » collées à d'autres mots (tesunconnard, salepute) ;
//   4. les expressions (nique ta mère, va te faire foutre…), même avec un mot glissé au milieu.
//  Les URLs et les @mentions ne sont jamais modifiées. Les exceptions ne sont jamais masquées.
// ─────────────────────────────────────────────────────────────

// Mots (forme simple : accepte aussi e / s / es / x à la fin et les lettres répétées)
const DEFAULT_WORDS = [
  // français — insultes
  'con', 'conne', 'connard', 'connarde', 'connasse', 'conasse', 'salope', 'salopard', 'salopiaud', 'salaud', 'pute', 'putain',
  'pouffiasse', 'pouf', 'grognasse', 'petasse', 'radasse', 'catin', 'encule', 'enculer', 'enculeur', 'enfoire', 'batard',
  'abruti', 'cretin', 'debile', 'imbecile', 'mongol', 'golmon', 'gogol', 'triso', 'trisomique', 'teube', 'teubay',
  'pede', 'pd', 'tapette', 'tafiole', 'tarlouze', 'lopette', 'gouine', 'negre', 'negro', 'bougnoule', 'bougnoul', 'youpin',
  'bicot', 'raton', 'chintok', 'niakoue', 'fdp', 'ntm', 'tg', 'ftg', 'vtff', 'merdeux', 'boloss', 'bolosse', 'cassos',
  'tocard', 'toquard', 'baltringue', 'bouffon', 'ordure', 'raclure', 'vermine', 'trouduc', 'couillon', 'branleur',
  'branleuse', 'suceur', 'suceuse', 'sousmerde',
  // anglais
  'fuck', 'fucker', 'fucking', 'motherfucker', 'fuckface', 'bitch', 'asshole', 'cunt', 'nigger', 'nigga', 'faggot', 'fag',
  'whore', 'slut', 'bastard', 'dickhead', 'retard', 'kys',
];
// « putain » est un juron plus qu'une insulte : il est retiré par défaut (un admin peut le remettre avec /filtre ajouter putain)
const DEFAULT_REMOVED = ['putain', 'retard', 'raton', 'ordure', 'vermine', 'couillon', 'pouf'];

// Expressions (un mot de remplissage est toléré entre chaque mot : « nique bien ta mère »)
const DEFAULT_PHRASES = [
  'nique ta mere', 'nique ta race', 'nique ta grand mere', 'nique tes morts', 'nique ta soeur', 'nique ton pere',
  'niquer ta mere', 'baise ta mere', 'ta mere la pute', 'fils de pute', 'fils de chien', 'fille de pute', 'enfant de catin',
  'ta gueule', 'ferme ta gueule', 'ferme ta bouche', 'va te faire foutre', 'va te faire enculer', 'va te faire mettre',
  'va te faire voir', 'creve charogne',
  // « ^ » : seulement en début de phrase (« va crever ! » oui, « le pneu va crever » non)
  '^va crever', '^va mourir', 'je te baise', 'suce ma bite', 'suce moi', 'mange tes morts',
  'trou du cul', 'tete de noeud', 'tete de cul', 'tete de con', 'face de rat', 'sac a merde', 'sous merde', 'petite bite',
  'gros porc', 'grosse vache', 'grosse truie', 'sale chien', 'sale chienne', 'sale race', 'sale arabe', 'sale noir',
  'sale juif', 'sale pd', 'pauvre con', 'pauvre conne', 'pauvre type', 'gros con', 'grosse conne', 'sale con',
  'va te suicider', 'suicide toi', 'tue toi', 'pends toi', 'kill yourself', 'son of a bitch', 'piece of shit',
  'go fuck yourself', 'fuck you', 'fuck off', 'shut up bitch',
];

// Insultes assez longues et caractéristiques pour être repérées même collées à d'autres mots
const STRONG = [
  'connard', 'connasse', 'salope', 'salopard', 'encule', 'enfoire', 'petasse', 'pouffiasse', 'grognasse', 'batard',
  'tafiole', 'tarlouze', 'bougnoule', 'fdp', 'motherfucker', 'fuck', 'bitch', 'asshole', 'nigger', 'nigga', 'faggot',
  'filsdepute', 'niquetamere', 'tagueule', 'vatefairefoutre', 'trouducul',
];

// Mots légitimes qui ressemblent à une insulte une fois normalisés
// (vérifié sur 210 000 mots distincts d'un corpus d'œuvres françaises)
const DEFAULT_EXCEPTIONS = ['cone', 'cones', 'tge', 'tgs', 'repetasse', 'repetasses', 'bitche', 'mongole', 'mongoles', 'soupconnasse', 'soupconnasses'];
// Expressions légitimes dont les mots ne sont jamais masqués
const SAFE_PHRASES = ['tapette a mouche', 'tapette a mouches', 'tapette a souris', 'rio negro'];

// ─── Normalisation caractère par caractère ───────────────────

const HOMOGLYPHS = {
  'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y',
  'х': 'x', 'і': 'i', 'ї': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'ӏ': 'l', 'ո': 'n', 'ս': 'u',
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ϲ': 'c',
  'ø': 'o', 'ß': 'ss', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'p', 'ı': 'i',
};
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '€': 'e', '£': 'l' };
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁪-⁯﻿]/u;

/** Forme normalisée d'un seul caractère : '' (invisible), lettre(s) latine(s) minuscules, ou le caractère tel quel. */
function normChar(ch) {
  if (INVISIBLE.test(ch)) return '';
  let c = ch.normalize('NFKC').toLowerCase();
  c = c.replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  c = Array.from(c).map(x => HOMOGLYPHS[x] || x).join('');
  c = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (LEET[c]) c = LEET[c];
  return c;
}

/** Normalise un mot entier (pour les listes et les exceptions). */
function normWord(w) {
  return Array.from(String(w)).map(normChar).join('').replace(/[^a-z]/g, '');
}

const letterRe = (word) => normWord(word).split('').map(l => `${l}+`).join('');
const wordRegex = (word) => new RegExp(`^${letterRe(word)}(?:e|s|es|x)?$`);

// ─── Compilation des listes ──────────────────────────────────

function compileLists({ words = [], exceptions = [], removed = [] } = {}) {
  const off = new Set([...DEFAULT_REMOVED.filter(w => !words.includes(w)), ...removed]);
  const allWords = [...new Set([...DEFAULT_WORDS, ...words.filter(w => !w.includes(' '))])].filter(w => !off.has(w));
  const phrases = [...DEFAULT_PHRASES, ...words.filter(w => w.includes(' '))].filter(p => !off.has(p));
  return {
    words: allWords.map(w => ({ w: normWord(w), re: wordRegex(w) })),
    phrases: phrases.map(p => {
      const atStart = p.startsWith('^');
      const parts = p.replace(/^\^/, '').split(' ').map(wordRegex);
      parts.atStart = atStart;
      return parts;
    }),
    // collées à la FIN d'un mot (« tesunconnard », « bandedeconnasses ») : évite « soupçonnassent »
    strong: STRONG.filter(w => !off.has(w)).map(w => new RegExp(`${letterRe(w)}(?:e|s|es|x)?$`)),
    safe: SAFE_PHRASES.map(p => p.split(' ').map(wordRegex)),
    exceptions: new Set([...DEFAULT_EXCEPTIONS, ...exceptions].map(normWord)),
  };
}

// ─── Découpage du message ────────────────────────────────────

const PROTECTED = /https?:\/\/\S+|(?<![\p{L}\p{N}])@[A-Za-z0-9_]{1,30}/gu;   // URLs et mentions : jamais modifiées
const JOINERS = /^[.\-_*~|/\\•·+]{1,3}$/;                  // ponctuation qui « coupe » un mot (sa-lope)
const LETTER_GAP = /^[\s.\-_*~|/\\•·,+]{1,3}$/;             // séparateurs entre lettres isolées (c o n)

function tokenize(text) {
  const protectedRanges = [];
  let m;
  PROTECTED.lastIndex = 0;
  while ((m = PROTECTED.exec(text))) protectedRanges.push([m.index, m.index + m[0].length]);
  const isProtected = (i) => protectedRanges.some(([a, b]) => i >= a && i < b);

  // Cellules : un caractère d'origine → sa forme normalisée
  const cells = [];
  let i = 0;
  for (const ch of text) {
    const n = isProtected(i) ? '\u0000' : normChar(ch);
    cells.push({ raw: ch, n, start: i, end: i + ch.length });
    i += ch.length;
  }
  const isLetter = (c) => c && /^[a-z]+$/.test(c.n);
  // « ! » et « | » au milieu d'un mot valent « i » (p!te), « * » et « # » une lettre masquée (c*nnard)
  cells.forEach((c, k) => {
    const prev = cells[k - 1], next = cells[k + 1];
    if ((c.raw === '!' || c.raw === '|') && isLetter(prev) && isLetter(next)) c.n = 'i';
    else if ((c.raw === '*' || c.raw === '#') && isLetter(prev) && (isLetter(next) || (next && (next.raw === '*' || next.raw === '#')))) c.n = '?';
  });

  const tokens = [];
  let cur = null;
  cells.forEach((c) => {
    if (c.n === '') return;                                     // invisible : ignoré
    if (/^[a-z?]+$/.test(c.n)) {
      if (!cur) cur = { norm: '', start: c.start, end: c.end };
      cur.norm += c.n; cur.end = c.end;
    } else if (cur) { tokens.push(cur); cur = null; }
  });
  if (cur) tokens.push(cur);
  tokens.forEach(t => { t.wild = t.norm.includes('?'); });
  return tokens;
}

// ─── Recherche ───────────────────────────────────────────────

function matchesWord(norm, lists) {
  if (lists.exceptions.has(norm)) return false;
  if (!norm.includes('?')) return lists.words.some(x => x.re.test(norm));
  // Lettres masquées : « c*nnard » correspond à « connard » (au plus la moitié des lettres masquées)
  const stars = (norm.match(/\?/g) || []).length;
  if (stars * 2 > norm.length || norm.replace(/\?/g, '').length < 2) return false;
  const re = new RegExp(`^${norm.replace(/\?/g, '[a-z]')}(?:e|s|es|x)?$`);
  return lists.words.some(x => x.w.length >= 3 && re.test(x.w));
}

/**
 * Renvoie les plages [début, fin) du texte d'origine à masquer.
 */
function findInsults(text, lists) {
  const tokens = tokenize(text);
  const ranges = [];
  const gapText = (a, b) => text.slice(a.end, b.start);
  const add = (a, b) => ranges.push([a.start, b.end]);

  // 1. Mots isolés (+ lettres masquées)
  tokens.forEach(t => { if (matchesWord(t.norm, lists)) add(t, t); });

  // 2. Groupes de morceaux collés par de la ponctuation (sa-lope, con.nard)
  //    ou de lettres isolées séparées par des espaces/points (c o n n a r d, f.d.p)
  let g = 0;
  while (g < tokens.length) {
    let h = g;
    while (h + 1 < tokens.length) {
      const gap = gapText(tokens[h], tokens[h + 1]);
      const bothSingle = tokens[h].norm.length === 1 && tokens[h + 1].norm.length === 1;
      if (JOINERS.test(gap) || (bothSingle && LETTER_GAP.test(gap))) h++; else break;
    }
    if (h > g) {
      const group = tokens.slice(g, h + 1);
      const allSingle = group.every(t => t.norm.length === 1);
      const full = group.map(t => t.norm).join('');
      if (matchesWord(full, lists)) add(group[0], group[group.length - 1]);
      else if (!allSingle) {
        // Morceaux de plusieurs lettres : on teste aussi les sous-suites (« bande de sa-lopes »)
        for (let a = 0; a < group.length; a++) {
          let joined = group[a].norm;
          for (let b = a + 1; b < group.length; b++) {
            joined += group[b].norm;
            if (matchesWord(joined, lists)) add(group[a], group[b]);
          }
        }
      }
    }
    g = h + 1;
  }

  // 3. Insultes fortes collées à d'autres mots (tesunconnard) — mots de 6 lettres ou plus
  tokens.forEach(t => {
    if (t.norm.length < 6 || lists.exceptions.has(t.norm) || t.wild) return;
    if (lists.strong.some(re => re.test(t.norm))) add(t, t);
  });

  // 4. Expressions, avec au plus un mot glissé entre deux mots de l'expression
  lists.phrases.forEach(phrase => {
    for (let s = 0; s < tokens.length; s++) {
      if (!phrase[0].test(tokens[s].norm)) continue;
      if (phrase.atStart) {
        const before = text.slice(0, tokens[s].start);
        if (before.trim() && !/[.!?;:\n]\s*["«(]*\s*$/.test(before)) continue;   // pas en début de phrase
      }
      let k = s, ok = true;
      const used = [s];
      for (let p = 1; p < phrase.length && ok; p++) {
        if (tokens[k + 1] && phrase[p].test(tokens[k + 1].norm)) k += 1;
        else if (tokens[k + 2] && phrase[p].test(tokens[k + 2].norm)) k += 2;
        else ok = false;
        used.push(k);
      }
      if (ok) used.forEach(u => add(tokens[u], tokens[u]));
    }
  });
  // Expressions légitimes : leurs mots ne sont pas masqués
  const safeRanges = [];
  lists.safe.forEach(phrase => {
    for (let s = 0; s + phrase.length <= tokens.length; s++) {
      if (phrase.every((re, k) => re.test(tokens[s + k].norm))) safeRanges.push([tokens[s].start, tokens[s + phrase.length - 1].end]);
    }
  });
  return ranges.filter(([a, b]) => !safeRanges.some(([x, y]) => a >= x && b <= y));
}

/** Masque : garde la première lettre, remplace les autres lettres/chiffres par « * ». */
function maskRange(str) {
  let first = true;
  return Array.from(str).map(ch => {
    if (!/[\p{L}\p{N}$@€£!|*#]/u.test(ch)) return ch;
    if (first) { first = false; return ch; }
    return '*';
  }).join('');
}

/** Masque les insultes. Renvoie { text, hits } (hits = nombre de passages masqués). */
function censorWith(text, lists) {
  if (!text) return { text, hits: 0 };
  const ranges = findInsults(text, lists).sort((a, b) => a[0] - b[0]);
  if (!ranges.length) return { text, hits: 0 };
  // Fusionne les plages qui se chevauchent
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  let out = '', pos = 0;
  merged.forEach(([a, b]) => { out += text.slice(pos, a) + maskRange(text.slice(a, b)); pos = b; });
  return { text: out + text.slice(pos), hits: merged.length };
}

module.exports = { DEFAULT_WORDS, DEFAULT_PHRASES, DEFAULT_EXCEPTIONS, DEFAULT_REMOVED, STRONG, normWord, compileLists, censorWith };
