/* eslint-disable */
import React from 'react';
import { THEMES } from '../hooks/appearance';

/** Marque des pages de connexion : les cinq voyelles de Rimbaud, chacune dans la couleur de son thème. */
export default function AuthBrand({ compact = false }) {
  return (
    <div style={{ marginBottom: compact ? 10 : 0 }}>
      <div className="auth-vowels" aria-hidden="true" style={{ fontSize: compact ? 26 : 54 }}>
        {THEMES.map((t, i) => (
          <span key={t.id} style={{ color: t.id === 'blanc' ? 'var(--text-primary)' : t.accent, animationDelay: `${i * 70}ms` }}>{t.letter}</span>
        ))}
      </div>
      {!compact && <h1 className="auth-title" style={{ marginTop: 6 }}>FriendChat</h1>}
    </div>
  );
}
