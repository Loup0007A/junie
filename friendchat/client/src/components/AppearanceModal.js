/* eslint-disable */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { THEMES, TEXT_SIZES, getAppearance, saveAppearance } from '../hooks/appearance';

/** Choix du thème « Voyelles » et de la taille du texte. Les changements s'appliquent tout de suite. */
export default function AppearanceModal({ onClose }) {
  const [cur, setCur] = useState(getAppearance());
  const [hover, setHover] = useState(null);
  const set = (next) => setCur(saveAppearance(next));
  const shown = THEMES.find(t => t.id === (hover || cur.theme));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()} role="dialog" aria-label="Apparence">
        <div className="modal-header">
          <h3 className="modal-title">Apparence</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="form-label" style={{ marginBottom: 10 }}>Thème — les Voyelles de Rimbaud</div>
        <div className="vowel-grid" role="radiogroup">
          {THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={cur.theme === t.id}
              className={`vowel-tile${cur.theme === t.id ? ' selected' : ''}`}
              style={{ background: t.base, color: t.accent, boxShadow: t.id === 'blanc' ? 'inset 0 0 0 1px rgba(22,26,35,.12)' : 'none' }}
              onClick={() => set({ theme: t.id })}
              onMouseEnter={() => setHover(t.id)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="vowel-letter">{t.letter}</span>
              <span className="vowel-name" style={{ color: t.id === 'blanc' ? '#161a23' : '#eeeaf3' }}>{t.name}</span>
            </button>
          ))}
        </div>
        <div className="vowel-verse">« {shown.verse} »</div>

        <div className="form-label" style={{ margin: '20px 0 8px' }}>Taille du texte des messages</div>
        <div className="segmented" role="radiogroup">
          {TEXT_SIZES.map(s => (
            <button key={s.id} type="button" role="radio" aria-checked={cur.size === s.id} className={cur.size === s.id ? 'on' : ''} onClick={() => set({ size: s.id })} style={{ fontSize: s.px }}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Terminé</button>
        </div>
      </div>
    </div>
  );
}
