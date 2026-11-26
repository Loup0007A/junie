/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useAuth, useSocket, api } from '../hooks/useContexts';
import MessageBubble, { DateDivider } from './MessageBubble';
import MessageInput from './MessageInput';
import { Avatar } from './Sidebar';
import { openRimbaudPicker } from './RimbaudGame';
import PollModal from './PollModal';
import { openProfile } from './ProfileCard';
import { isSoundOn, setSoundOn, notificationPermission, notificationsSupported, requestNotifications } from '../hooks/notify';
import { Search, Feather, Bell, BellOff, BellRing, Menu, X, Pin, Globe, ArrowDown, MessageCircle, BookOpen } from 'lucide-react';
import { openPoem } from './PoemReader';

// ─── Recherche dans la conversation ─────────────────────────
function Highlight({ text, query }) {
  const q = query.trim();
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return parts.map((p, i) => p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>);
}

function SearchPanel({ withId, onJumpTo, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const debounce = useRef(null);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounce.current = setTimeout(() => {
      setLoading(true);
      api.get('/api/messages/search', { params: { q: q.trim(), with: withId } })
        .then(r => setResults(r.data)).catch(() => setResults([])).finally(() => setLoading(false));
    }, 300);
  }, [q, withId]);

  const open = (r) => {
    // Jump to the message if it is loaded, otherwise show it in full here
    if (document.getElementById(`msg-${r.id}`)) onJumpTo(r.id);
    else setExpanded(expanded === r.id ? null : r.id);
  };

  return (
    <div className="search-panel">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          className="input"
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
          placeholder="Rechercher dans cette conversation…"
          style={{ flex: 1, padding: '6px 10px' }}
        />
        {loading && <span className="spinner" />}
        <button className="btn btn-ghost btn-icon" onClick={onClose} title="Fermer (Échap)" aria-label="Fermer la recherche"><X size={17} /></button>
      </div>
      {q.trim().length >= 2 && (
        <div className="search-results">
          {!loading && results.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 6 }}>Aucun résultat.</div>}
          {results.map(r => (
            <button key={r.id} className="search-result" onClick={() => open(r)}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text-secondary)' }}>{r.sender_name}</b> · {new Date(r.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {r.type === 'poll' && ' · sondage'}
              </div>
              <div style={expanded === r.id ? { whiteSpace: 'pre-wrap' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Highlight text={r.content} query={q} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Header buttons: search, Rimbaud game, sounds, browser notifications
function HeaderTools({ isGlobal, onRimbaud, onSearch, searching }) {
  const [sound, setSound] = useState(isSoundOn());
  const [perm, setPerm] = useState(notificationPermission());
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
      {notificationsSupported() && perm === 'default' && (
        <button className="btn btn-secondary btn-sm hide-mobile" onClick={async () => setPerm(await requestNotifications())} title="Recevoir une notification quand on te mentionne ou t'écrit en privé">
          <BellRing size={14} /> Activer les notifications
        </button>
      )}
      {isGlobal && (
        <button className="btn btn-ghost btn-sm" onClick={onRimbaud} title="Jeu : complète un vers de Rimbaud (/rimbaud)">
          <Feather size={16} /> <span className="hide-mobile">Rimbaud</span>
        </button>
      )}
      <button className="btn btn-ghost btn-icon" onClick={() => openPoem('')} title="Lire un poème de Rimbaud (/poeme)" aria-label="Lire un poème"><BookOpen size={17} /></button>
      <button className={`btn btn-icon ${searching ? 'btn-secondary' : 'btn-ghost'}`} onClick={onSearch} title="Rechercher (Ctrl+F)" aria-label="Rechercher"><Search size={17} /></button>
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => { setSoundOn(!sound); setSound(!sound); }}
        title={sound ? 'Couper le son des mentions et MP' : 'Activer le son des mentions et MP'}
        aria-label={sound ? 'Couper le son' : 'Activer le son'}
      >{sound ? <Bell size={17} /> : <BellOff size={17} />}</button>
    </div>
  );
}

// Pinned messages bar: latest pin, expandable list
function PinnedBar({ pins, onJumpTo, canUnpin, onUnpin }) {
  const [open, setOpen] = useState(false);
  if (!pins.length) return null;
  const latest = pins[0];
  const excerpt = (m) => m.type === 'poll' ? `Sondage : ${m.content}` : m.type === 'text' ? m.content.replace(/[*~`<>]/g, '') : m.type === 'gif' ? 'GIF' : 'Image';
  return (
    <>
      <div className="pinned-bar">
        <Pin size={15} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
        <button className="main" onClick={() => onJumpTo(latest.id)} title="Aller au message">
          <div style={{ fontSize: 11, color: 'var(--accent-light)', fontWeight: 700 }}>Épinglé{pins.length > 1 ? ` · ${pins.length} messages` : ''}</div>
          <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b>{latest.sender_name}</b> : {excerpt(latest)}</div>
        </button>
        {pins.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}>{open ? 'Masquer' : 'Tout voir'}</button>}
      </div>
      {open && (
        <div className="pinned-list">
          {pins.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="search-result" style={{ flex: 1, minWidth: 0 }} onClick={() => onJumpTo(m.id)}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><b style={{ color: 'var(--text-secondary)' }}>{m.sender_name}</b> · épinglé par {m.pinned?.by}</div>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{excerpt(m)}</div>
              </button>
              {canUnpin && <button className="btn btn-ghost btn-icon" onClick={() => onUnpin(m.id)} title="Désépingler" aria-label="Désépingler"><X size={14} /></button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function groupMessages(messages) {
  const groups = [];
  let prevSenderId = null;
  let prevDay = null;
  let prevTs = 0;

  messages.forEach((msg, i) => {
    const msgDay = new Date(msg.created_at).toDateString();
    // New group when the sender changes, the day changes, or after 7 minutes of silence
    const showAvatar = msg.sender_id !== prevSenderId || msgDay !== prevDay || msg.created_at - prevTs > 7 * 60 * 1000 || msg.type === 'poll';
    if (!prevDay || msgDay !== prevDay) groups.push({ type: 'date', date: msg.created_at, key: `date-${msg.id}` });
    groups.push({ type: 'message', message: msg, showAvatar, key: msg.id });
    prevSenderId = msg.sender_id;
    prevDay = msgDay;
    prevTs = msg.created_at;
  });
  return groups;
}

const PAGE = 50;
const FIRST_PAGE = 150;

export default function ChatWindow({ chatId, chatUser, clearedTs, onOpenMenu, menuBadge = 0 }) {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [pins, setPins] = useState([]);
  const [typing, setTyping] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeout = useRef({});
  const prependAnchor = useRef(null);
  const atBottomRef = useRef(true);
  const isGlobal = chatId === 'global';
  const scope = isGlobal ? 'global' : 'private';
  const base = isGlobal ? '/api/messages/global' : `/api/messages/private/${chatUser?.id}`;

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setNewBelow(0);
  }, []);

  // When admin runs /clear, wipe messages from view
  useEffect(() => { if (clearedTs && isGlobal) setMessages([]); }, [clearedTs, isGlobal]);

  // Load latest messages + pins
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    api.get(base, { params: { limit: FIRST_PAGE } })
      .then(r => {
        setMessages(r.data);
        setHasMore(r.data.length >= FIRST_PAGE);
        setTimeout(() => scrollToBottom(false), 30);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get('/api/messages/pinned', { params: { with: isGlobal ? 'global' : chatUser?.id } }).then(r => setPins(r.data)).catch(() => {});
  }, [chatId, chatUser?.id]);

  // Infinite scroll: load older messages when reaching the top
  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || !messages.length) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    prependAnchor.current = el ? { height: el.scrollHeight, top: el.scrollTop } : null;
    try {
      const r = await api.get(base, { params: { before: messages[0].created_at, limit: PAGE } });
      setHasMore(r.data.length >= PAGE);
      setMessages(prev => [...r.data.filter(m => !prev.some(p => p.id === m.id)), ...prev]);
    } catch { prependAnchor.current = null; }
    setLoadingOlder(false);
  }, [loadingOlder, hasMore, messages, base]);

  // Keep the reading position when older messages are prepended
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && prependAnchor.current) {
      el.scrollTop = el.scrollHeight - prependAnchor.current.height + prependAnchor.current.top;
      prependAnchor.current = null;
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    atBottomRef.current = bottom;
    setAtBottom(bottom);
    if (bottom) setNewBelow(0);
    if (el.scrollTop < 120) loadOlder();
  };

  // New message: follow it if we're at the bottom (or it's ours), otherwise show the "new messages" button
  const onIncoming = useCallback((msg) => {
    if (atBottomRef.current || msg.sender_id === user.id) setTimeout(() => scrollToBottom(), 40);
    else setNewBelow(n => n + 1);
  }, [user.id, scrollToBottom]);

  // Socket events
  useEffect(() => {
    if (!socket) return;
    const add = (msg) => setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);

    const handleNewGlobal = (msg) => { if (isGlobal) { add(msg); onIncoming(msg); } };
    const handleNewPrivate = (msg) => {
      if (isGlobal) return;
      const relevant = (msg.sender_id === user.id && msg.receiver_id === chatUser?.id) || (msg.sender_id === chatUser?.id && msg.receiver_id === user.id);
      if (!relevant) return;
      add(msg);
      if (msg.sender_id !== user.id) socket.emit('mark_read', { senderId: msg.sender_id });
      onIncoming(msg);
    };
    const patch = (id, p) => setMessages(prev => prev.map(m => m.id === id ? { ...m, ...p } : m));
    const handleDeleted = ({ id }) => { patch(id, { deleted: true }); setPins(prev => prev.filter(m => m.id !== id)); };
    const handleReactions = ({ id, reactions }) => patch(id, { reactions });
    const handleUpdated = ({ id, ...p }) => patch(id, p);
    const handlePinned = ({ id, pinned, message }) => {
      const mine = isGlobal ? message.room === 'global' : [message.sender_id, message.receiver_id].includes(chatUser?.id);
      if (!mine) return;
      patch(id, { pinned });
      setPins(prev => pinned ? [message, ...prev.filter(m => m.id !== id)] : prev.filter(m => m.id !== id));
    };
    // Read receipts: the other person opened the conversation
    const handleRead = ({ readerId }) => {
      if (!isGlobal && readerId === chatUser?.id) setMessages(prev => prev.map(m => m.sender_id === user.id ? { ...m, read: true } : m));
    };
    const handleTyping = ({ userId, username, room }) => {
      const relevantRoom = isGlobal ? 'global' : `pm-${chatUser?.id}`;
      if (room === relevantRoom && userId !== user.id) {
        setTyping(prev => prev.includes(username) ? prev : [...prev, username]);
        clearTimeout(typingTimeout.current[userId]);
        typingTimeout.current[userId] = setTimeout(() => setTyping(prev => prev.filter(u => u !== username)), 3000);
      }
    };
    const handleStopTyping = ({ userId, room }) => {
      const relevantRoom = isGlobal ? 'global' : `pm-${chatUser?.id}`;
      if (room === relevantRoom) { clearTimeout(typingTimeout.current[userId]); setTyping([]); }
    };

    const handlers = {
      new_global_message: handleNewGlobal, new_private_message: handleNewPrivate, message_deleted: handleDeleted,
      message_reactions: handleReactions, message_updated: handleUpdated, message_pinned: handlePinned,
      messages_read: handleRead, user_typing: handleTyping, user_stop_typing: handleStopTyping,
    };
    Object.entries(handlers).forEach(([e, fn]) => socket.on(e, fn));
    return () => Object.entries(handlers).forEach(([e, fn]) => socket.off(e, fn));
  }, [socket, chatId, chatUser?.id, isGlobal, user.id, onIncoming]);

  const handleSend = useCallback(({ content, type }) => {
    if (!socket) return;
    // Slash commands are never sent as replies
    const replyTo = replyingTo && !(type === 'text' && content.startsWith('/')) ? replyingTo.id : null;
    if (isGlobal) socket.emit('send_global_message', { content, type, replyTo });
    else socket.emit('send_private_message', { receiverId: chatUser.id, content, type, replyTo });
    setReplyingTo(null);
  }, [socket, isGlobal, chatUser, replyingTo]);

  const handleTypingEmit = useCallback((stop = false) => {
    if (!socket) return;
    socket.emit(stop ? 'stop_typing' : 'typing', isGlobal ? { room: 'global' } : { receiverId: chatUser?.id });
  }, [socket, isGlobal, chatUser]);

  const handleAdminDelete = useCallback(async (msgId) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try { await api.delete(`/api/admin/messages/${msgId}`); } catch {}
  }, []);

  const handleReact = useCallback((messageId, emoji) => socket?.emit('toggle_reaction', { messageId, emoji, scope }), [socket, scope]);
  const handlePin = useCallback((messageId) => socket?.emit('toggle_pin', { messageId, scope }), [socket, scope]);
  const handleSaveEdit = useCallback((messageId, content) => {
    socket?.emit('edit_message', { messageId, content, scope });
    setEditingId(null);
  }, [socket, scope]);
  const handleDeleteOwn = useCallback((messageId) => {
    if (!window.confirm('Supprimer ton message ?')) return;
    socket?.emit('delete_own_message', { messageId, scope });
  }, [socket, scope]);
  const handleEditLast = useCallback(() => {
    const last = [...messages].reverse().find(m => m.sender_id === user.id && !m.deleted && (m.type || 'text') === 'text');
    if (last) setEditingId(last.id);
    return !!last;
  }, [messages, user.id]);
  const handleVote = useCallback((messageId, index) => socket?.emit('poll_vote', { messageId, index }), [socket]);
  const handleClosePoll = useCallback((messageId) => {
    if (window.confirm('Clore ce sondage ? Plus personne ne pourra voter.')) socket?.emit('poll_close', { messageId });
  }, [socket]);

  // Ctrl/Cmd+F opens the search panel
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setShowSearch(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleJumpTo = useCallback((id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('msg-flash');
    void el.offsetWidth; // restart the animation
    el.classList.add('msg-flash');
  }, []);

  const isMuted = user.muted && (!user.mute_until || user.mute_until > Date.now());
  const grouped = groupMessages(messages);
  const canPin = !isGlobal || user.role === 'admin';
  // "Seen" under my last private message once the other person has read it
  const lastOwnId = !isGlobal ? [...messages].reverse().find(m => m.sender_id === user.id && !m.deleted)?.id : null;
  const peer = !isGlobal && onlineUsers.find(u => u.userId === chatUser?.id);
  const peerPresence = peer ? (peer.presence || 'online') : 'offline';
  const onlineCount = new Set(onlineUsers.map(u => u.userId)).size;

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Header */}
      <header style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minHeight: 62 }}>
        <button className="btn btn-ghost btn-icon mobile-only" onClick={onOpenMenu} aria-label="Ouvrir le menu" style={{ position: 'relative' }}>
          <Menu size={20} />
          {menuBadge > 0 && <span className="notif-badge" style={{ position: 'absolute', top: 0, right: -2 }}>{menuBadge}</span>}
        </button>
        {isGlobal ? (
          <>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--accent-dim)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Globe size={20} strokeWidth={1.8} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>Chat global</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{onlineCount} en ligne</div>
            </div>
          </>
        ) : (
          <button onClick={() => openProfile(chatUser?.id)} title="Voir le profil" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 0, minWidth: 0, textAlign: 'left' }}>
            <Avatar user={chatUser} size={38} presence={peerPresence} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>{chatUser?.username}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
                {chatUser?.mood?.text ? `${chatUser.mood.emoji || ''} ${chatUser.mood.text}` : peerPresence === 'offline' ? 'Hors ligne' : peerPresence === 'away' ? 'Absent' : peerPresence === 'dnd' ? 'Ne pas déranger' : 'En ligne'}
              </div>
            </div>
          </button>
        )}
        <HeaderTools isGlobal={isGlobal} onRimbaud={openRimbaudPicker} onSearch={() => setShowSearch(v => !v)} searching={showSearch} />
      </header>

      {showSearch && (
        <SearchPanel withId={isGlobal ? 'global' : chatUser?.id} onJumpTo={handleJumpTo} onClose={() => setShowSearch(false)} />
      )}
      <PinnedBar pins={pins} onJumpTo={handleJumpTo} canUnpin={canPin} onUnpin={handlePin} />

      {/* Messages */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex' }}>
        <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
              <div className="spinner" />
              <span>Chargement des messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--accent-dim)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isGlobal ? <Globe size={30} strokeWidth={1.6} /> : <MessageCircle size={30} strokeWidth={1.6} />}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {isGlobal ? 'Le chat est calme' : `Aucun message avec ${chatUser?.username}`}
              </div>
              <p style={{ maxWidth: 320, fontSize: 14 }}>
                {isGlobal ? 'Écris le premier message, ou lance une partie avec /rimbaud.' : 'Envoie le premier message : il ne sera visible que par vous deux.'}
              </p>
            </div>
          ) : (
            <>
              {hasMore ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                  {loadingOlder ? <span className="spinner" /> : <button className="btn btn-ghost btn-sm" onClick={loadOlder}>Charger les messages précédents</button>}
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '16px 0 4px' }}>
                  {isGlobal ? 'Début du chat global' : `Début de ta conversation avec ${chatUser?.username}`}
                </div>
              )}
              {grouped.map(item =>
                item.type === 'date' ? (
                  <DateDivider key={item.key} date={item.date} />
                ) : (
                  <MessageBubble
                    key={item.key}
                    message={item.message}
                    showAvatar={item.showAvatar}
                    isOwn={item.message.sender_id === user.id}
                    onAdminDelete={handleAdminDelete}
                    canDelete={isGlobal}
                    onReact={handleReact}
                    onReply={setReplyingTo}
                    onJumpTo={handleJumpTo}
                    editing={editingId === item.message.id}
                    onStartEdit={setEditingId}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onDeleteOwn={handleDeleteOwn}
                    onVote={handleVote}
                    onClosePoll={handleClosePoll}
                    onPin={canPin ? handlePin : null}
                    seen={item.message.id === lastOwnId && item.message.read}
                  />
                )
              )}
            </>
          )}

          {typing.length > 0 && (
            <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="typing-indicator"><div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" /></div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{typing.join(', ')} écrit{typing.length > 1 ? 'ent' : ''}…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {(!atBottom && (newBelow > 0 || messages.length > 0)) && (
          <button className="jump-bottom" onClick={() => scrollToBottom()}>
            <ArrowDown size={14} style={{ verticalAlign: '-2px' }} /> {newBelow > 0 ? `${newBelow} nouveau${newBelow > 1 ? 'x' : ''} message${newBelow > 1 ? 's' : ''}` : 'Revenir en bas'}
          </button>
        )}
      </div>

      {isMuted && (
        <div className="alert alert-warning" style={{ margin: '0 16px 8px', borderRadius: 8 }}>
          Tu es muet(te){user.mute_until ? ` jusqu'à ${new Date(user.mute_until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ' (sans limite de durée)'}.
        </div>
      )}

      {showPoll && (
        <PollModal
          onClose={() => setShowPoll(false)}
          onCreate={(poll) => { socket?.emit('create_poll', poll); setShowPoll(false); }}
        />
      )}

      <MessageInput
        onSend={handleSend}
        onTyping={handleTypingEmit}
        disabled={isMuted}
        placeholder={isGlobal ? 'Écrire dans le chat global…' : `Écrire à ${chatUser?.username}…`}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onEditLast={handleEditLast}
        onOpenPoll={isGlobal ? () => setShowPoll(true) : null}
        draftKey={chatId}
      />
    </main>
  );
}
