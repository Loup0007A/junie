/* eslint-disable */
// Petites notifications : son, notification navigateur, compteur dans l'onglet.

const SOUND_KEY = 'fc_sound';

export function isSoundOn() {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}
export function setSoundOn(on) {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch {}
}

let audioCtx = null;
export function playPing() {
  if (!isSoundOn()) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    [[880, 0], [1320, 0.09]].forEach(([freq, delay]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, t + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.25);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.3);
    });
  } catch {}
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : 'denied');
export async function requestNotifications() {
  if (!notificationsSupported()) return 'denied';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export function showNotification(title, body, onClick) {
  if (!notificationsSupported() || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    const n = new Notification(title, {
      body: (body || '').slice(0, 160),
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: 'friendchat',
      renotify: true,
    });
    n.onclick = () => { window.focus(); onClick && onClick(); n.close(); };
  } catch {}
}

// Pastille de non-lus sur l'icône de l'onglet (dessinée à la volée)
let faviconImg = null;
export function setFaviconBadge(count) {
  const link = document.getElementById('favicon');
  if (!link) return;
  if (!count) { link.href = '/favicon.svg'; return; }
  const draw = () => {
    try {
      const size = 64;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.drawImage(faviconImg, 0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size - 17, 17, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0f0d12';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : String(count), size - 17, 18);
      link.href = c.toDataURL('image/png');
    } catch {}
  };
  if (faviconImg && faviconImg.complete) return draw();
  faviconImg = new Image();
  faviconImg.onload = draw;
  faviconImg.src = '/icons/icon-192.png';
}
