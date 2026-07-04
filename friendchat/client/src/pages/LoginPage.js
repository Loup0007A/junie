/* eslint-disable */
import React, { useState } from 'react';
import { useAuth } from '../hooks/useContexts';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('login'); // login | info

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return;
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">💬</div>
          <h1 className="auth-title">FriendChat</h1>
          <p className="auth-subtitle">Votre espace privé entre amis</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Nom d'utilisateur</label>
            <input
              className="input"
              type="text"
              placeholder="Entrez votre nom d'utilisateur"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              className="input"
              type="password"
              placeholder="Entrez votre mot de passe"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !form.username || !form.password}
            style={{ marginTop: 4 }}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div className="auth-divider" style={{ margin: '20px 0' }}>ou</div>

        <div className="auth-switch">
          Pas encore de compte ?{' '}
          <a href="/register">Faire une demande d'inscription</a>
        </div>

        <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(124,92,191,0.08)', borderRadius: 8, border: '1px solid rgba(124,92,191,0.15)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            🔒 Ce chat est privé — accès uniquement sur invitation de l'administrateur
          </p>
        </div>
      </div>
    </div>
  );
}
