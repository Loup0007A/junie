/* eslint-disable */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, useSocket, api } from '../hooks/useContexts';
import { Avatar } from '../components/Sidebar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function fmtDate(ts) {
  if (!ts) return '—';
  return format(new Date(Number(ts)), 'dd/MM/yyyy HH:mm', { locale: fr });
}

export default function AdminPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [newRequestCount, setNewRequestCount] = useState(0);
  const [muteModal, setMuteModal] = useState(null);
  const [search, setSearch] = useState('');

  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/requests');
      setRequests(r.data);
    } finally { setLoading(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/users');
      setUsers(r.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadRequests();
    loadUsers();
  }, []);

  useEffect(() => {
    if (tab === 'requests') loadRequests();
    else loadUsers();
  }, [tab]);

  // Socket notifications
  useEffect(() => {
    if (!socket) return;
    socket.on('new_registration_request', ({ username }) => {
      setNewRequestCount(prev => prev + 1);
      showNotif(`Nouvelle demande d'inscription de ${username}`, 'info');
      loadRequests();
    });
    socket.on('request_processed', () => loadRequests());
    return () => {
      socket.off('new_registration_request');
      socket.off('request_processed');
    };
  }, [socket]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/api/admin/requests/${id}/approve`);
      setRequests(prev => prev.filter(r => r.id !== id));
      setNewRequestCount(prev => Math.max(0, prev - 1));
      showNotif('Utilisateur approuvé ✅');
      loadUsers();
    } catch (err) {
      showNotif(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Rejeter cette demande ?')) return;
    try {
      await api.post(`/api/admin/requests/${id}/reject`);
      setRequests(prev => prev.filter(r => r.id !== id));
      setNewRequestCount(prev => Math.max(0, prev - 1));
      showNotif('Demande rejetée');
    } catch (err) {
      showNotif(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleBan = async (u) => {
    if (!window.confirm(`Bannir ${u.username} ?`)) return;
    try {
      await api.post(`/api/admin/users/${u.id}/ban`);
      showNotif(`${u.username} banni`);
      loadUsers();
    } catch (err) { showNotif(err.response?.data?.error || 'Erreur', 'error'); }
  };

  const handleUnban = async (u) => {
    try {
      await api.post(`/api/admin/users/${u.id}/unban`);
      showNotif(`${u.username} débanni`);
      loadUsers();
    } catch (err) { showNotif(err.response?.data?.error || 'Erreur', 'error'); }
  };

  const handleMute = async (userId, duration) => {
    try {
      await api.post(`/api/admin/users/${userId}/mute`, { duration });
      showNotif('Utilisateur muet');
      setMuteModal(null);
      loadUsers();
    } catch (err) { showNotif(err.response?.data?.error || 'Erreur', 'error'); }
  };

  const handleUnmute = async (u) => {
    try {
      await api.post(`/api/admin/users/${u.id}/unmute`);
      showNotif(`${u.username} peut de nouveau parler`);
      loadUsers();
    } catch (err) { showNotif(err.response?.data?.error || 'Erreur', 'error'); }
  };

  const handlePromote = async (u) => {
    if (!window.confirm(`Promouvoir ${u.username} en admin ?`)) return;
    try {
      await api.post(`/api/admin/users/${u.id}/promote`);
      showNotif(`${u.username} est maintenant admin`);
      loadUsers();
    } catch (err) { showNotif(err.response?.data?.error || 'Erreur', 'error'); }
  };

  const handleDemote = async (u) => {
    if (!window.confirm(`Rétrograder ${u.username} ?`)) return;
    try {
      await api.post(`/api/admin/users/${u.id}/demote`);
      showNotif(`${u.username} rétrogradé`);
      loadUsers();
    } catch (err) { showNotif(err.response?.data?.error || 'Erreur', 'error'); }
  };

  const handleToggleInvisible = async (u) => {
    try {
      const r = await api.post(`/api/admin/users/${u.id}/toggle-invisible`);
      showNotif(`${u.username} est maintenant ${r.data.invisible ? 'invisible' : 'visible'}`);
      loadUsers();
    } catch (err) { showNotif(err.response?.data?.error || 'Erreur', 'error'); }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id: 'requests', label: 'Demandes', icon: '📨', badge: requests.length },
    { id: 'users', label: 'Utilisateurs', icon: '👥', badge: null },
    { id: 'stats', label: 'Statistiques', icon: '📊', badge: null },
  ];

  const approvedCount = users.filter(u => u.status === 'approved' && !u.banned).length;
  const bannedCount = users.filter(u => u.banned).length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  return (
    <div className="app-container" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <div style={{ width: 200, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>⚙️ Administration</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user.username}</div>
        </div>

        <nav style={{ padding: 8 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 8, border: 'none',
                background: tab === t.id ? 'var(--accent-dim)' : 'transparent',
                color: tab === t.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 14, fontWeight: tab === t.id ? 600 : 400,
                fontFamily: 'var(--font-body)', marginBottom: 2, transition: 'all var(--transition)'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </span>
              {t.badge > 0 && <span className="notif-badge">{t.badge}</span>}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ padding: 8 }}>
          <a href="/chat" className="btn btn-secondary btn-sm" style={{ width: '100%', display: 'flex' }}>
            ← Retour au chat
          </a>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>
            {tab === 'requests' && '📨 Demandes d\'inscription'}
            {tab === 'users' && '👥 Gestion des utilisateurs'}
            {tab === 'stats' && '📊 Statistiques'}
          </h1>
          {loading && <div className="spinner" />}
        </div>

        {/* Notification */}
        {notification && (
          <div className={`alert alert-${notification.type}`} style={{ margin: '12px 24px 0', animation: 'slideIn 0.2s ease' }}>
            {notification.msg}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Requests tab */}
          {tab === 'requests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                  <p>Aucune demande en attente</p>
                </div>
              ) : requests.map(req => (
                <div key={req.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                    {req.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15 }}>{req.username}</strong>
                      {req.email && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{req.email}</span>}
                      <span className="badge badge-pending">En attente</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Demande reçue le {fmtDate(req.created_at)}
                    </div>
                    {req.reason && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent)' }}>
                        "{req.reason}"
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-success btn-sm" onClick={() => handleApprove(req.id)}>✓ Approuver</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleReject(req.id)}>✕ Rejeter</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Users tab */}
          {tab === 'users' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <input
                  className="input"
                  placeholder="Rechercher un utilisateur…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ maxWidth: 320 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredUsers.map(u => (
                  <UserRow
                    key={u.id}
                    u={u}
                    currentUser={user}
                    onBan={handleBan}
                    onUnban={handleUnban}
                    onMute={() => setMuteModal(u)}
                    onUnmute={handleUnmute}
                    onPromote={handlePromote}
                    onDemote={handleDemote}
                    onToggleInvisible={handleToggleInvisible}
                  />
                ))}
              </div>
            </>
          )}

          {/* Stats tab */}
          {tab === 'stats' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                { icon: '👥', label: 'Membres actifs', value: approvedCount, color: 'var(--success)' },
                { icon: '⛔', label: 'Comptes bannis', value: bannedCount, color: 'var(--danger)' },
                { icon: '👑', label: 'Administrateurs', value: adminCount, color: 'var(--accent-light)' },
                { icon: '📨', label: 'Demandes en attente', value: requests.length, color: 'var(--warning)' },
                { icon: '👤', label: 'Total comptes', value: users.length, color: 'var(--info)' },
              ].map((stat, i) => (
                <div key={i} className="card" style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{stat.icon}</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: stat.color, fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mute modal */}
      {muteModal && (
        <MuteModal
          user={muteModal}
          onMute={handleMute}
          onClose={() => setMuteModal(null)}
        />
      )}
    </div>
  );
}

function UserRow({ u, currentUser, onBan, onUnban, onMute, onUnmute, onPromote, onDemote, onToggleInvisible }) {
  const isSelf = u.id === currentUser.id;

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
      <Avatar user={u} size={40} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>{u.username}</strong>
          {u.role === 'admin' && <span className="badge badge-admin">Admin</span>}
          {u.banned && <span className="badge badge-banned">Banni</span>}
          {u.muted && <span className="badge badge-muted">Muet</span>}
          {u.invisible && <span className="badge" style={{ background: 'rgba(156,163,175,0.15)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.3)' }}>👻 Invisible</span>}
          {u.mustChangePassword && <span className="badge" style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--warning)' }}>🔑 Doit changer MDP</span>}
          {isSelf && <span className="badge" style={{ background: 'rgba(74,222,128,0.1)', color: 'var(--success)' }}>Vous</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {u.email || 'Pas d\'email'} · Inscrit le {u.created_at ? format(new Date(Number(u.created_at) * 1000), 'dd/MM/yyyy') : '?'}
          {u.last_seen && ` · Vu le ${format(new Date(Number(u.last_seen)), 'dd/MM/yyyy HH:mm')}`}
        </div>
      </div>

      {!isSelf && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Invisible toggle */}
          <button className="btn btn-secondary btn-sm" onClick={() => onToggleInvisible(u)} title="Masquer/afficher dans la liste des membres">
            {u.invisible ? '👁️ Rendre visible' : '👻 Rendre invisible'}
          </button>

          {/* Mute/Unmute */}
          {u.muted ? (
            <button className="btn btn-secondary btn-sm" onClick={() => onUnmute(u)}>🔊 Démuter</button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => onMute(u)}>🔇 Muter</button>
          )}

          {/* Ban/Unban */}
          {u.banned ? (
            <button className="btn btn-secondary btn-sm" onClick={() => onUnban(u)}>✅ Débannir</button>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={() => onBan(u)}>⛔ Bannir</button>
          )}

          {/* Promote/Demote */}
          {u.role === 'admin' ? (
            <button className="btn btn-secondary btn-sm" onClick={() => onDemote(u)}>↓ Rétrograder</button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => onPromote(u)}>↑ Promouvoir</button>
          )}
        </div>
      )}
    </div>
  );
}

function MuteModal({ user, onMute, onClose }) {
  const [duration, setDuration] = useState('60');

  const PRESETS = [
    { label: '10 minutes', value: '10' },
    { label: '1 heure', value: '60' },
    { label: '24 heures', value: '1440' },
    { label: '1 semaine', value: '10080' },
    { label: 'Permanent', value: '0' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <h3 className="modal-title">🔇 Muter {user.username}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="form-label">Durée</label>
          {PRESETS.map(p => (
            <label key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: duration === p.value ? 'var(--accent-dim)' : 'var(--bg-elevated)', border: `1px solid ${duration === p.value ? 'var(--accent)' : 'var(--border)'}`, transition: 'all var(--transition)' }}>
              <input type="radio" name="duration" value={p.value} checked={duration === p.value} onChange={() => setDuration(p.value)} style={{ display: 'none' }} />
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid', borderColor: duration === p.value ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {duration === p.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
              <span style={{ fontSize: 14 }}>{p.label}</span>
            </label>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => onMute(user.id, parseInt(duration))}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
