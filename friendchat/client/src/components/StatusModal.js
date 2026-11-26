/* eslint-disable */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth, useSocket } from '../hooks/useContexts';

export const PRESENCES = [
  { id: 'online', label: 'En ligne', hint: 'Notifications normales' },
  { id: 'away', label: 'Absent', hint: 'Les autres voient que tu n’es pas là' },
  { id: 'dnd', label: 'Ne pas déranger', hint: 'Aucun son ni notification' },
];
const PRESETS = [
  { emoji: '🎮', text: 'En train de jouer' },
  { emoji: '📚', text: 'Au travail / en cours' },
  { emoji: '🍕', text: 'À table' },
  { emoji: '🚗', text: 'Sur la route' },
  { emoji: '😴', text: 'Au lit' },
  { emoji: '🎧', text: 'En musique' },
];

/** Statut personnalisé : emoji + texte court + disponibilité. */
export default function StatusModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const [emoji, setEmoji] = useState(user.mood?.emoji || '');
  const [text, setText] = useState(user.mood?.text || '');
  const [presence, setPresence] = useState(user.presence || 'online');

  const save = (e) => {
    e?.preventDefault();
    const mood = emoji || text.trim() ? { emoji, text: text.trim() } : null;
    socket?.emit('set_status', { emoji, text: text.trim(), presence });
    updateUser({ mood, presence });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()} onSubmit={save}>
        <div className="modal-header">
          <h3 className="modal-title">Mon statut</h3>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="form-group">
          <label className="form-label">Disponibilité</label>
          {PRESENCES.map(p => (
            <label key={p.id} className="nav-item" style={{ background: presence === p.id ? 'var(--accent-dim)' : undefined, color: 'var(--text-primary)' }}>
              <input type="radio" name="presence" checked={presence === p.id} onChange={() => setPresence(p.id)} style={{ accentColor: 'var(--accent)' }} />
              <span style={{ position: 'relative', width: 10, height: 10 }}><span className={`presence-dot presence-${p.id}`} style={{ width: 10, height: 10, border: 'none', inset: 0 }} /></span>
              <span style={{ flex: 1 }}>{p.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.hint}</span>
            </label>
          ))}
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">Message de statut</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" value={emoji} onChange={e => setEmoji(Array.from(e.target.value).slice(-2).join(''))} placeholder="🙂" aria-label="Emoji du statut" style={{ width: 56, textAlign: 'center', fontSize: 18, padding: '6px' }} />
            <input className="input" value={text} maxLength={60} onChange={e => setText(e.target.value)} placeholder="Qu'est-ce que tu fais ?" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {PRESETS.map(p => (
              <button key={p.text} type="button" className="btn btn-secondary btn-sm" onClick={() => { setEmoji(p.emoji); setText(p.text); }}>
                {p.emoji} {p.text}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          {(emoji || text) && <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => { setEmoji(''); setText(''); }}>Effacer le message</button>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
