/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useAuth, useSocket, api } from '../hooks/useContexts';

function Avatar({ user, size = 36, online = false }) {
  const initial = (user?.username || '?')[0].toUpperCase();
  const colors = ['#7c5cbf', '#5c8abf', '#5cbf7c', '#bf5c7c', '#bf9c5c', '#5cbfbf'];
  const color = colors[(user?.username?.charCodeAt(0) || 0) % colors.length];

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {user?.avatar ? (
        <img
          src={user.avatar.startsWith('/') ? user.avatar : `/${user.avatar}`}
          alt={user.username}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
        />
      ) : null}
      <div style={{
        width: size, height: size, borderRadius: '50%', background: color, display: user?.avatar ? 'none' : 'flex',
        alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38,
        color: '#fff', flexShrink: 0, border: '2px solid var(--border)'
      }}>
        {initial}
      </div>
      {online !== undefined && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: size * 0.3, height: size * 0.3,
          borderRadius: '50%', border: '2px solid var(--bg-surface)',
          background: online ? 'var(--success)' : 'var(--text-muted)'
        }} />
      )}
    </div>
  );
}

export { Avatar };

export default function Sidebar({ activeChat, onSelectChat, unreadCounts }) {
  const { user, logout } = useAuth();
  const { onlineUsers } = useSocket();
  const [users, setUsers] = useState([]);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    api.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const isOnline = (userId) => onlineUsers.some(u => u.userId === userId);
  const totalUnread = Object.values(unreadCounts || {}).reduce((a, b) => a + b, 0);

  const onlineUsersList = users.filter(u => isOnline(u.id) && u.id !== user.id);
  const offlineUsersList = users.filter(u => !isOnline(u.id) && u.id !== user.id);

  return (
    <div style={{
      width: 'var(--sidebar-width)',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>FriendChat</span>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ padding: '8px 8px 0' }}>
        {/* Global Chat */}
        <button
          onClick={() => onSelectChat('global')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8, border: 'none',
            background: activeChat === 'global' ? 'var(--accent-dim)' : 'transparent',
            color: activeChat === 'global' ? 'var(--accent-light)' : 'var(--text-secondary)',
            cursor: 'pointer', transition: 'all var(--transition)', fontFamily: 'var(--font-body)',
            fontSize: 14, fontWeight: activeChat === 'global' ? 600 : 400
          }}
          onMouseEnter={e => { if (activeChat !== 'global') e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { if (activeChat !== 'global') e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 18 }}>🌐</span>
          <span>Chat Global</span>
        </button>

        {/* Admin Panel */}
        {user.role === 'admin' && (
          <a
            href="/admin"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all var(--transition)',
              fontSize: 14, textDecoration: 'none', marginTop: 2,
              fontFamily: 'var(--font-body)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 18 }}>⚙️</span>
            <span>Administration</span>
          </a>
        )}
      </div>

      {/* Users list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* Online */}
        {onlineUsersList.length > 0 && (
          <>
            <div style={{ padding: '8px 10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              En ligne — {onlineUsersList.length}
            </div>
            {onlineUsersList.map(u => (
              <UserItem
                key={u.id} u={u} user={user} online={true}
                active={activeChat === `pm-${u.id}`}
                unread={unreadCounts[u.id] || 0}
                onSelect={() => onSelectChat(`pm-${u.id}`, u)}
              />
            ))}
          </>
        )}
        {/* Offline */}
        {offlineUsersList.length > 0 && (
          <>
            <div style={{ padding: '12px 10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Hors ligne — {offlineUsersList.length}
            </div>
            {offlineUsersList.map(u => (
              <UserItem
                key={u.id} u={u} user={user} online={false}
                active={activeChat === `pm-${u.id}`}
                unread={unreadCounts[u.id] || 0}
                onSelect={() => onSelectChat(`pm-${u.id}`, u)}
              />
            ))}
          </>
        )}
      </div>

      {/* Current user footer */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg-elevated)'
      }}>
        <button
          onClick={() => setShowProfile(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: 0, borderRadius: 6, overflow: 'hidden' }}
        >
          <Avatar user={user} size={34} online={true} />
          <div style={{ textAlign: 'left', overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.username}
            </div>
            {user.role === 'admin' && <div style={{ fontSize: 11, color: 'var(--accent-light)' }}>Admin</div>}
          </div>
        </button>
        <button className="btn btn-ghost btn-icon" onClick={logout} title="Déconnexion">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>

        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      </div>
    </div>
  );
}

function UserItem({ u, user, online, active, unread, onSelect }) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 10px', borderRadius: 8, border: 'none',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer', transition: 'all var(--transition)',
        fontFamily: 'var(--font-body)', fontSize: 14, marginBottom: 1
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Avatar user={u} size={30} online={online} />
      <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
        <div style={{ fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
          {u.username}
          {u.role === 'admin' && <span style={{ fontSize: 9, background: 'var(--accent-dim)', color: 'var(--accent-light)', padding: '1px 5px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>Admin</span>}
        </div>
      </div>
      {unread > 0 && (
        <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>
      )}
    </button>
  );
}

function ProfileModal({ onClose }) {
  const { user, updateUser, api } = useAuth();
  const [bio, setBio] = useState(user.bio || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('bio', bio);
      if (avatarFile) fd.append('avatar', avatarFile);
      const r = await api.put('/api/users/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser(r.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Mon profil</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Avatar upload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              {(preview || user.avatar) ? (
                <img
                  src={preview || user.avatar}
                  alt="avatar"
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, border: '2px solid var(--border)' }}>
                  {user.username[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                📷 Changer l'avatar
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
              <p className="form-hint" style={{ marginTop: 4 }}>JPG, PNG, GIF — max 5MB</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea
              className="input"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Dites quelque chose sur vous…"
              rows={3}
              style={{ resize: 'none' }}
              maxLength={200}
            />
            <span className="form-hint">{bio.length}/200</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
