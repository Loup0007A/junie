import React, { useState } from 'react';
import { api } from '../hooks/useContexts';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '', email: '', reason: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Les mots de passe ne correspondent pas');
    if (form.password.length < 6) return setError('Le mot de passe doit contenir au moins 6 caractères');

    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        username: form.username,
        password: form.password,
        email: form.email || undefined,
        reason: form.reason || undefined
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la demande');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo-icon" style={{ margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✅</div>
        <h2 style={{ marginBottom: 12 }}>Demande envoyée !</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Votre demande d'inscription a été soumise à l'administrateur. Vous serez notifié(e) dès qu'elle sera traitée.
        </p>
        <a href="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>Retour à la connexion</a>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">📝</div>
          <h1 className="auth-title">Rejoindre FriendChat</h1>
          <p className="auth-subtitle">Votre demande sera examinée par l'admin</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Nom d'utilisateur *</label>
            <input
              className="input"
              type="text"
              placeholder="Entre 3 et 20 caractères"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              required
            />
            <span className="form-hint">Lettres, chiffres et underscores uniquement</span>
          </div>

          <div className="form-group">
            <label className="form-label">Email (optionnel)</label>
            <input
              className="input"
              type="email"
              placeholder="votre@email.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe *</label>
            <input
              className="input"
              type="password"
              placeholder="Au moins 6 caractères"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmer le mot de passe *</label>
            <input
              className="input"
              type="password"
              placeholder="Répétez votre mot de passe"
              value={form.confirmPassword}
              onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Pourquoi souhaitez-vous rejoindre ? (optionnel)</label>
            <textarea
              className="input"
              placeholder="Présentez-vous brièvement…"
              value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              rows={3}
              style={{ resize: 'none' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
        </form>

        <div className="auth-switch" style={{ marginTop: 20 }}>
          Déjà un compte ? <a href="/login">Se connecter</a>
        </div>
      </div>
    </div>
  );
}
