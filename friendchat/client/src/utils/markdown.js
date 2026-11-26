/* eslint-disable */
// ─────────────────────────────────────────────────────────────
//  Rendu sécurisé des messages (Markdown léger → HTML)
//
//  Trois barrières contre le XSS :
//   1. tout le texte est échappé (& < > " ') AVANT d'ajouter le moindre balisage ;
//   2. seuls quelques balisages connus sont recréés, les liens sont validés
//      (http/https uniquement) et réencodés ;
//   3. le résultat passe dans DOMPurify avec une liste blanche stricte
//      (balises, attributs, schémas d'URL).
// ─────────────────────────────────────────────────────────────

import DOMPurify from 'dompurify';

const COLORS = ['red', 'green', 'blue', 'purple', 'yellow', 'orange', 'pink'];

export const MENTION_RE = /(^|[\s(>])@([A-Za-z0-9_]{3,20})(?![A-Za-z0-9_])/g;
export const EMOJI_SEQ = /(?:\p{Regional_Indicator}{2}|[#*0-9]️?⃣|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*)/gu;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ESC[c]);
const unescapeHtml = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));

/** URL http(s) valide, ou null. */
export function safeHttpUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}

/** Source d'image acceptable : fichier envoyé sur le site ou URL https. */
export function safeMediaSrc(src) {
  if (typeof src !== 'string') return null;
  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(src)) return src;
  const u = safeHttpUrl(src);
  return u && u.startsWith('https://') ? u : null;
}

// Liens : on travaille sur le texte déjà échappé, on s'arrête aux guillemets/chevrons échappés
const URL_IN_ESCAPED = /https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<])+/g;
const TRAILING = /(?:[.,!?;:)\]]|&#39;|&quot;)+$/;

function linkify(html) {
  return html.replace(URL_IN_ESCAPED, (match) => {
    const trail = (match.match(TRAILING) || [''])[0];
    const escapedUrl = trail ? match.slice(0, -trail.length) : match;
    const href = safeHttpUrl(unescapeHtml(escapedUrl));
    if (!href) return match;
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow" class="md-link">${escapedUrl}</a>${trail}`;
  });
}

// Emojis dans le texte : un peu plus gros (uniquement hors balises)
function enlargeInlineEmojis(html) {
  return html.split(/(<[^>]+>)/).map(part => part.startsWith('<') ? part : part.replace(EMOJI_SEQ, '<span class="emoji-inline">$&</span>')).join('');
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['a', 'u', 'span', 'strong', 'em', 's', 'code', 'pre', 'blockquote', 'br'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOWED_URI_REGEXP: /^https?:\/\//i,
  ALLOW_DATA_ATTR: false,
};

let hooked = false;
function purify(html) {
  if (!hooked) {
    // Tout lien s'ouvre dans un nouvel onglet, sans accès à la page d'origine
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    });
    hooked = true;
  }
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

/** Markdown léger → HTML sûr. */
export function renderMarkdown(text, myUsername) {
  if (!text) return '';
  let html = escapeHtml(text)
    // Balises maison autorisées (souligné, couleurs de la barre d'outils)
    .replace(/&lt;u&gt;/g, '<u>').replace(/&lt;\/u&gt;/g, '</u>')
    .replace(/&lt;span class=&quot;color-([a-z]+)&quot;&gt;/g, (m, c) => COLORS.includes(c) ? `<span class="color-${c}">` : m)
    .replace(/&lt;\/span&gt;/g, '</span>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Gras / italique / barré : le contenu doit commencer et finir par un caractère visible
    // et contenir au moins une lettre ou un chiffre (« c * * * * » masqué par le filtre reste intact)
    .replace(/\*\*(?=\S)([^*]*?[\p{L}\p{N}][^*]*?)(?<=\S)\*\*/gu, '<strong>$1</strong>')
    .replace(/\*(?=\S)([^*]*?[\p{L}\p{N}][^*]*?)(?<=\S)\*/gu, '<em>$1</em>')
    .replace(/~~(?=\S)([^~]*?[\p{L}\p{N}][^~]*?)(?<=\S)~~/gu, '<s>$1</s>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = linkify(html)
    .replace(MENTION_RE, (m, pre, name) => {
      const me = myUsername && name.toLowerCase() === myUsername.toLowerCase();
      return `${pre}<span class="mention${me ? ' mention-me' : ''}">@${name}</span>`;
    })
    .replace(/\n/g, '<br>');
  return purify(enlargeInlineEmojis(html));
}
