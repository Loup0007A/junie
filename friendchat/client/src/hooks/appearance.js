/* eslint-disable */
// Apparence : thèmes « Voyelles » (Rimbaud) et taille du texte, mémorisés dans le navigateur.

export const THEMES = [
  { id: 'noir', letter: 'A', name: 'Noir', verse: 'A, noir corset velu des mouches éclatantes', base: '#0f0d12', accent: '#e3b93c' },
  { id: 'blanc', letter: 'E', name: 'Blanc', verse: 'E, candeurs des vapeurs et des tentes', base: '#eef1f6', accent: '#2f55d4' },
  { id: 'rouge', letter: 'I', name: 'Rouge', verse: 'I, pourpres, sang craché, rire des lèvres belles', base: '#130c0e', accent: '#f04e5e' },
  { id: 'vert', letter: 'U', name: 'Vert', verse: 'U, cycles, vibrements divins des mers virides', base: '#0b1411', accent: '#2fd08a' },
  { id: 'bleu', letter: 'O', name: 'Bleu', verse: 'O, suprême Clairon plein des strideurs étranges', base: '#0a0f1c', accent: '#4c8dff' },
];

export const TEXT_SIZES = [
  { id: 's', label: 'Petit', px: '13.5px' },
  { id: 'm', label: 'Normal', px: '14.5px' },
  { id: 'l', label: 'Grand', px: '16.5px' },
];

const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export function getAppearance() {
  const theme = read('fc_theme', 'noir');
  const size = read('fc_text_size', 'm');
  return {
    theme: THEMES.some(t => t.id === theme) ? theme : 'noir',
    size: TEXT_SIZES.some(s => s.id === size) ? size : 'm',
  };
}

export function applyAppearance({ theme, size } = getAppearance()) {
  const root = document.documentElement;
  if (theme === 'noir') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
  root.style.setProperty('--msg-size', (TEXT_SIZES.find(s => s.id === size) || TEXT_SIZES[1]).px);
  const meta = document.querySelector('meta[name="theme-color"]');
  const t = THEMES.find(x => x.id === theme);
  if (meta && t) meta.setAttribute('content', t.base);
}

export function saveAppearance(next) {
  const cur = { ...getAppearance(), ...next };
  write('fc_theme', cur.theme);
  write('fc_text_size', cur.size);
  applyAppearance(cur);
  window.dispatchEvent(new Event('fc:appearance'));
  return cur;
}

export const isLightTheme = () => getAppearance().theme === 'blanc';

// Couleur stable par pseudo (teinte dérivée du nom, luminosité selon le thème)
export function nameColor(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)) % 360;
  return `hsl(${h} 62% var(--name-l))`;
}
