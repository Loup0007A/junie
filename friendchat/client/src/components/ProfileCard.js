/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Shield } from 'lucide-react';
import { useAuth, useSocket, api } from '../hooks/useContexts';
import { Avatar } from './Sidebar';
import { PRESENCES } from './StatusModal';

// Ouvre la carte de profil d'un membre depuis n'importe où
export const openProfile = (userId) => window.dispatchEvent(new CustomEvent('fc:open-profile', { detail: { userId } }));

const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
function lastSeenText(ts) {
  if (!ts) return 'jamais vu';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `le ${fmtDate(ts)}`;
}

/** Carte de profil (montée une fois dans ChatPage, ouverte via openProfile). */
export default function ProfileCard({ onMessage }) {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const open = (e) => { setUserId(e.detail.userId); setProfile(null); setError(null); };
    window.addEventListener('fc:open-profile', open);
    return () => window.removeEventListener('fc:open-profile', open);
  }, []);

  useEffect(() => {
    if (!userId || userId === 'system') return;
    api.get(`/api/users/${userId}/profile`).then(r => setProfile(r.data)).catch(e => setError(e.response?.data?.error || 'Profil indisponible'));
  }, [userId]);

  if (!userId || userId === 'system') return null;
  const close = () => setUserId(null);
  const online = onlineUsers.find(u => u.userId === userId);
  const presence = online ? (online.presence || 'online') : 'offline';
  const presenceLabel = online ? PRESENCES.find(p => p.id === presence)?.label : `Hors ligne · vu ${lastSeenText(profile?.lastSeen)}`;

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal profile-card" style={{ position: 'relative' }} onClick={e => e.stopPropagation()} role="dialog" aria-label="Profil">
        <div className="profile-banner" />
        <button className="btn btn-ghost btn-icon" onClick={close} aria-label="Fermer" style={{ position: 'absolute', top: 10, right: 10, color: 'var(--on-accent)' }}><X size={18} /></button>
        <div className="profile-body">
          {error ? <div className="alert alert-error" style={{ marginTop: 52 }}>{error}</div> : !profile ? (
            <div style={{ paddingTop: 60, display: 'flex', justifyContent: 'center' }}><span className="spinner" /></div>
          ) : (
            <>
              <div style={{ border: '4px solid var(--bg-surface)', borderRadius: '50%', display: 'inline-block' }}>
                <Avatar user={profile} size={76} presence={presence} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800 }}>{profile.username}</h2>
                {profile.role === 'admin' && <span className="badge badge-admin" style={{ gap: 4 }}><Shield size={11} /> Admin</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{presenceLabel}</div>
              {profile.mood && (profile.mood.emoji || profile.mood.text) && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 14 }}>
                  {profile.mood.emoji} {profile.mood.text}
                </div>
              )}
              {profile.bio && <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{profile.bio}</p>}
              <div className="profile-stats">
                <div className="profile-stat"><b>{profile.stats.messages}</b><span>messages</span></div>
                <div className="profile-stat"><b>{profile.stats.rimbaudPoints}</b><span>points Rimbaud</span></div>
                <div className="profile-stat"><b>{profile.stats.rimbaudWins}</b><span>vers trouvés</span></div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Membre depuis le {fmtDate(profile.createdAt)}</div>
              {profile.id !== user.id && (
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => { onMessage && onMessage(profile); close(); }}>
                  <MessageCircle size={16} /> Envoyer un message privé
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
