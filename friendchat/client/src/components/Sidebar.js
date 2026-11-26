/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { Globe, Shield, Search, Palette, LogOut, X, Camera, KeyRound, Sparkles } from 'lucide-react';
import { useAuth, useSocket, api } from '../hooks/useContexts';
import { THEMES } from '../hooks/appearance';
import AppearanceModal from './AppearanceModal';
import StatusModal, { PRESENCES } from './StatusModal';

const AVATAR_COLORS = ['#8a6fd1', '#4f7fc9', '#3fa36b', '#c9566f', '#c9973f', '#3aa7a7', '#b85fb0'];

/**
 * Avatar rond : photo ou initiale colorée, pastille de disponibilité.
 * presence: 'online' | 'away' | 'dnd' | 'offline' (ou l'ancien booléen `online`).
 */
function Avatar({ user, size = 36, online, presence }) {
  const isSystem = user?.id === 'system';
  const initial = (Array.from(user?.username || '?')[0] || '?').toUpperCase();
  let h = 0; for (const c of user?.username || '') h = (h * 31 + c.codePointAt(0)) >>> 0;
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length];
  const p = presence || (online === undefined ? null : online ? 'online' : 'offline');
  const [broken, setBroken] = useState(false);
  const showImg = user?.avatar && !broken && !isSystem;

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      {showImg ? (
        <img
          src={user.avatar.startsWith('/') || user.avatar.startsWith('http') ? user.avatar : `/${user.avatar}`}
          alt=""
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          onError={() => setBroken(true)}
        />
      ) : (
        <div aria-hidden="true" style={{
          width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isSystem ? 'var(--accent-dim)' : color, color: isSystem ? 'var(--accent-light)' : '#fff',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: size * 0.42,
        }}>
          {isSystem ? <Sparkles size={size * 0.5} /> : initial}
        </div>
      )}
      {p && (
        <span className={`presence-dot presence-${p}`} style={{ width: Math.max(9, size * 0.3), height: Math.max(9, size * 0.3) }} title={p === 'offline' ? 'Hors ligne' : PRESENCES.find(x => x.id === p)?.label} />
      )}
    </div>
  );
}

export { Avatar };

export function MoodLine({ mood }) {
  if (!mood || (!mood.emoji && !mood.text)) return null;
  return <div className="member-status">{mood.emoji} {mood.text}</div>;
}

export default function Sidebar({ activeChat, onSelectChat, unreadCounts, open, onClose }) {
  const { user, logout } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null); // profile | status | appearance

  useEffect(() => {
    api.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  // Live status updates
  useEffect(() => {
    if (!socket) return;
    const onStatus = ({ userId, mood, presence }) => setUsers(prev => prev.map(u => u.id === userId ? { ...u, mood, presence } : u));
    socket.on('user_status', onStatus);
    return () => socket.off('user_status', onStatus);
  }, [socket]);

  const presenceOf = (id) => {
    const o = onlineUsers.find(u => u.userId === id);
    return o ? (o.presence || 'online') : 'offline';
  };
  const q = filter.trim().toLowerCase();
  const others = users.filter(u => u.id !== user.id && (!q || u.username.toLowerCase().includes(q)));
  const onlineList = others.filter(u => presenceOf(u.id) !== 'offline');
  const offlineList = others.filter(u => presenceOf(u.id) === 'offline');
  const myPresence = user.presence || 'online';

  const select = (id, u) => { onSelectChat(id, u); onClose && onClose(); };

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <nav className={`sidebar${open ? ' open' : ''}`} aria-label="Conversations">
        {/* Brand */}
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center' }}>
          <div className="brand">
            FriendChat
            <span className="brand-vowels" aria-hidden="true">
              {THEMES.map(t => <span key={t.id} style={{ color: t.id === 'blanc' ? 'var(--text-primary)' : t.accent }}>{t.letter}</span>)}
            </span>
          </div>
          <button className="btn btn-ghost btn-icon mobile-only" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Fermer le menu"><X size={18} /></button>
        </div>

        {/* Navigation */}
        <div style={{ padding: '0 8px' }}>
          <button className={`nav-item${activeChat === 'global' ? ' active' : ''}`} onClick={() => select('global')}>
            <Globe size={18} strokeWidth={1.8} />
            <span>Chat global</span>
          </button>
          {user.role === 'admin' && (
            <a className="nav-item" href="/admin">
              <Shield size={18} strokeWidth={1.8} />
              <span>Administration</span>
            </a>
          )}
        </div>

        <div className="sidebar-search" style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
          <input className="input" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Chercher un membre" aria-label="Chercher un membre" style={{ paddingLeft: 30 }} />
        </div>

        {/* Members */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {onlineList.length > 0 && <div className="nav-section">En ligne · {onlineList.length}</div>}
          {onlineList.map(u => (
            <MemberItem key={u.id} u={u} presence={presenceOf(u.id)} active={activeChat === `pm-${u.id}`} unread={unreadCounts[u.id] || 0} onSelect={() => select(`pm-${u.id}`, u)} />
          ))}
          {offlineList.length > 0 && <div className="nav-section">Hors ligne · {offlineList.length}</div>}
          {offlineList.map(u => (
            <MemberItem key={u.id} u={u} presence="offline" active={activeChat === `pm-${u.id}`} unread={unreadCounts[u.id] || 0} onSelect={() => select(`pm-${u.id}`, u)} />
          ))}
          {others.length === 0 && q && <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>Aucun membre ne correspond à « {filter} ».</div>}
        </div>

        {/* Me */}
        <div style={{ padding: '10px 10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)' }}>
          <button onClick={() => setModal('profile')} title="Modifier mon profil" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: '50%' }}>
            <Avatar user={user} size={36} presence={myPresence} />
          </button>
          <button onClick={() => setModal('status')} title="Changer mon statut" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.username}</div>
            <div className="member-status">
              {user.mood && (user.mood.emoji || user.mood.text) ? `${user.mood.emoji || ''} ${user.mood.text || ''}` : PRESENCES.find(p => p.id === myPresence)?.label}
            </div>
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => setModal('appearance')} title="Apparence" aria-label="Apparence"><Palette size={17} /></button>
          <button className="btn btn-ghost btn-icon" onClick={logout} title="Se déconnecter" aria-label="Se déconnecter"><LogOut size={17} /></button>
        </div>
      </nav>
      {modal === 'profile' && <ProfileModal onClose={() => setModal(null)} />}
      {modal === 'status' && <StatusModal onClose={() => setModal(null)} />}
      {modal === 'appearance' && <AppearanceModal onClose={() => setModal(null)} />}
    </>
  );
}

function MemberItem({ u, presence, active, unread, onSelect }) {
  return (
    <button className={`nav-item${active ? ' active' : ''}`} onClick={onSelect} style={{ opacity: presence === 'offline' && !active ? 0.62 : 1 }}>
      <Avatar user={u} size={32} presence={presence} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', fontWeight: unread ? 700 : 500 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username}</span>
          {u.role === 'admin' && <Shield size={12} style={{ color: 'var(--accent-light)', flexShrink: 0 }} aria-label="Admin" />}
        </div>
        <MoodLine mood={u.mood} />
      </div>
      {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
    </button>
  );
}

function ProfileModal({ onClose }) {
  const { user, updateUser, api } = useAuth();
  const [bio, setBio] = useState(user.bio || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
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
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
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
                  {(Array.from(user.username)[0] || '?').toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Camera size={15} /> Changer l'avatar
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
          <button className="btn btn-secondary btn-sm" onClick={() => setShowChangePwd(true)} style={{ marginRight: 'auto' }}><KeyRound size={15} /> Mot de passe</button>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            Enregistrer
          </button>
        </div>
        {showChangePwd && <ChangePasswordModalInline onClose={() => setShowChangePwd(false)} />}
      </div>
    </div>
  );
}

function ChangePasswordModalInline({ onClose }) {
  const { api } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.next.length < 6) return setError('6 caractères minimum');
    if (form.next !== form.confirm) return setError('Les mots de passe ne correspondent pas');
    setLoading(true);
    try {
      await api.post('/api/users/change-password', { currentPassword: form.current, newPassword: form.next });
      setOk(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h3 className="modal-title">Changer le mot de passe</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        {ok ? <div className="alert alert-success">Mot de passe changé.</div> : (
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">Mot de passe actuel</label>
              <input className="input" type="password" value={form.current} onChange={e=>setForm(p=>({...p,current:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Nouveau mot de passe</label>
              <input className="input" type="password" value={form.next} onChange={e=>setForm(p=>({...p,next:e.target.value}))} placeholder="6 caractères min" required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmer</label>
              <input className="input" type="password" value={form.confirm} onChange={e=>setForm(p=>({...p,confirm:e.target.value}))} required />
            </div>
            <div className="modal-footer" style={{marginTop:4}}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : null} Confirmer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
