/* eslint-disable */
// Petits utilitaires de texte

const EMOJI = /(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*)️?/gu;
const LEADING = /^\s*(?:(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*)️?\s*)+/u;

/** Retire tous les emojis (pour les textes d'interface venant du serveur). */
export const stripEmoji = (s = '') => s.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').replace(/\s+([!?.,:)])/g, '$1').trim();
/** Retire les emojis décoratifs en début de texte (« 🏆 Bravo » → « Bravo »). */
export const stripLeadingEmoji = (s = '') => s.replace(LEADING, '');
