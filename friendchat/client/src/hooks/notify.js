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
    const n = new Notification(title, { body: (body || '').slice(0, 160), tag: 'friendchat', renotify: true });
    n.onclick = () => { window.focus(); onClick && onClick(); n.close(); };
  } catch {}
}
