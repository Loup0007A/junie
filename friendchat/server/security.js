// ─────────────────────────────────────────────────────────────
//  Sécurité HTTP et validation des contenus
//   - en-têtes de sécurité (CSP stricte, nosniff, anti-iframe…)
//   - fichiers envoyés : on vérifie le vrai contenu (signature binaire),
//     pas seulement l'extension
//   - messages « image » / « gif » : seules des adresses sûres sont acceptées
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

// Content-Security-Policy de l'application : aucun script inline ni externe,
// même si du HTML parvenait un jour à être injecté.
const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  'frame-src https://www.youtube-nocookie.com',
  "media-src 'self' https:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// Fichiers envoyés : servis comme de simples images, jamais exécutés
const UPLOADS_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (!req.path.startsWith('/api/')) {
    res.setHeader('Content-Security-Policy', req.path.startsWith('/uploads/') ? UPLOADS_CSP : APP_CSP);
  }
  next();
}

// ─── Fichiers envoyés ────────────────────────────────────────

const SIGNATURES = [
  { ext: '.png', test: (b) => b.length > 8 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG' },
  { ext: '.jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.gif', test: (b) => b.length > 6 && /^GIF8[79]a$/.test(b.toString('ascii', 0, 6)) },
  { ext: '.webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

/**
 * Vérifie qu'un fichier reçu est vraiment une image (PNG, JPEG, GIF, WebP)
 * et le renomme avec l'extension correspondant à son contenu.
 * Renvoie le nouveau nom de fichier, ou null (fichier supprimé) s'il est refusé.
 */
function verifyUploadedImage(file) {
  if (!file) return null;
  let head;
  try {
    const fd = fs.openSync(file.path, 'r');
    head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
  } catch { head = Buffer.alloc(0); }
  const sig = SIGNATURES.find(s => s.test(head));
  if (!sig) {
    try { fs.unlinkSync(file.path); } catch {}
    return null;
  }
  const base = path.basename(file.filename, path.extname(file.filename));
  const finalName = `${base}${sig.ext}`;
  if (finalName !== file.filename) {
    fs.renameSync(file.path, path.join(path.dirname(file.path), finalName));
  }
  return finalName;
}

// ─── Contenus des messages ───────────────────────────────────

const UPLOAD_URL = /^\/uploads\/[0-9a-f-]{36}\.(png|jpg|gif|webp)$/;
const GIF_HOSTS = /(^|\.)(giphy\.com|tenor\.com|tenor\.googleapis\.com)$/;

/** Valide le contenu d'un message image / GIF. Renvoie true si acceptable. */
function isSafeMediaContent(type, content) {
  if (type === 'text') return true;
  if (typeof content !== 'string' || content.length > 1000) return false;
  if (type === 'image') return UPLOAD_URL.test(content);
  if (type === 'gif') {
    if (UPLOAD_URL.test(content)) return true;
    try {
      const u = new URL(content);
      return u.protocol === 'https:' && GIF_HOSTS.test(u.hostname) && !u.username && !u.password;
    } catch { return false; }
  }
  return false;
}

module.exports = { securityHeaders, verifyUploadedImage, isSafeMediaContent };
