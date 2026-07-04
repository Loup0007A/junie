/* eslint-disable */
import React, { useState } from 'react';
import { api, useAuth } from '../hooks/useContexts';

export default function ChangePasswordModal({ forced = false, onClose }) {
  const { updateUser } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 6) return setError('Minimum 6 caractères');
    if (form.newPassword !== form.confirm) return setError('Les mots de passe ne correspondent pas');
    setLoading(true);
    try {
      await api.post('/api/users/change-password', {
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword
      });
      updateUser({ mustChangePassword: false });
      setSuccess(true);
      setTimeout(() => onClose && onClose(), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">
            {forced ? '🔐 Changez votre mot de passe' : '🔑 Changer le mot de passe'}
          </h3>
          {!forced && (
            <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
          )}
        </div>

        {forced && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            Pour des raisons de sécurité, vous devez changer votre mot de passe avant de continuer.
          </div>
        )}

        {success ? (
          <div className="alert alert-success">
            ✅ Mot de passe changé avec succès !
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className="alert alert-error">{error}</div>}

            {!forced && (
              <div className="form-group">
                <label className="form-label">Mot de passe actuel</label>
                <input
                  className="input"
                  type="password"
                  value={form.currentPassword}
                  onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Nouveau mot de passe</label>
              <input
                className="input"
                type="password"
                value={form.newPassword}
                onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
                autoFocus={forced}
                autoComplete="new-password"
                placeholder="Minimum 6 caractères"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirmer le nouveau mot de passe</label>
              <input
                className="input"
                type="password"
                value={form.confirm}
                onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="modal-footer" style={{ marginTop: 8 }}>
              {!forced && (
                <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
              )}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : null}
                Changer le mot de passe
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
