/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, useSocket, api } from '../hooks/useContexts';
import MessageBubble, { DateDivider } from './MessageBubble';
import MessageInput from './MessageInput';
import { Avatar } from './Sidebar';
import { } from 'date-fns';

function groupMessages(messages) {
  const groups = [];
  let prevSenderId = null;
  let prevDay = null;

  messages.forEach((msg, i) => {
    const msgDate = new Date(msg.created_at);
    const msgDay = msgDate.toDateString();
    const showAvatar = msg.sender_id !== prevSenderId || msgDay !== prevDay;
    const showDate = !prevDay || msgDay !== prevDay;

    if (showDate) groups.push({ type: 'date', date: msg.created_at, key: `date-${i}` });
    groups.push({ type: 'message', message: msg, showAvatar, key: msg.id });

    prevSenderId = msg.sender_id;
    prevDay = msgDay;
  });

  return groups;
}

export default function ChatWindow({ chatId, chatUser }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState([]);
  const bottomRef = useRef(null);
  const typingTimeout = useRef({});
  const isGlobal = chatId === 'global';

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Load messages
  useEffect(() => {
    setLoading(true);
    setMessages([]);

    const endpoint = isGlobal
      ? '/api/messages/global'
      : `/api/messages/private/${chatUser?.id}`;

    api.get(endpoint)
      .then(r => {
        setMessages(r.data);
        setTimeout(() => scrollToBottom(false), 50);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chatId, chatUser?.id]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewGlobal = (msg) => {
      if (isGlobal) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => scrollToBottom(), 50);
      }
    };

    const handleNewPrivate = (msg) => {
      if (!isGlobal) {
        const isRelevant =
          (msg.sender_id === user.id && msg.receiver_id === chatUser?.id) ||
          (msg.sender_id === chatUser?.id && msg.receiver_id === user.id);
        if (isRelevant) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Mark as read
          if (msg.sender_id !== user.id) {
            socket.emit('mark_read', { senderId: msg.sender_id });
          }
          setTimeout(() => scrollToBottom(), 50);
        }
      }
    };

    const handleDeleted = ({ id }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted: true } : m));
    };

    const handleTyping = ({ userId, username, room }) => {
      const relevantRoom = isGlobal ? 'global' : `pm-${chatUser?.id}`;
      if (room === relevantRoom && userId !== user.id) {
        setTyping(prev => prev.includes(username) ? prev : [...prev, username]);
        clearTimeout(typingTimeout.current[userId]);
        typingTimeout.current[userId] = setTimeout(() => {
          setTyping(prev => prev.filter(u => u !== username));
        }, 3000);
      }
    };

    const handleStopTyping = ({ userId, room }) => {
      const relevantRoom = isGlobal ? 'global' : `pm-${chatUser?.id}`;
      if (room === relevantRoom) {
        clearTimeout(typingTimeout.current[userId]);
        setTyping([]);
      }
    };

    socket.on('new_global_message', handleNewGlobal);
    socket.on('new_private_message', handleNewPrivate);
    socket.on('message_deleted', handleDeleted);
    socket.on('user_typing', handleTyping);
    socket.on('user_stop_typing', handleStopTyping);

    return () => {
      socket.off('new_global_message', handleNewGlobal);
      socket.off('new_private_message', handleNewPrivate);
      socket.off('message_deleted', handleDeleted);
      socket.off('user_typing', handleTyping);
      socket.off('user_stop_typing', handleStopTyping);
    };
  }, [socket, chatId, chatUser?.id, isGlobal, user.id]);

  const handleSend = useCallback(({ content, type }) => {
    if (!socket) return;
    if (isGlobal) {
      socket.emit('send_global_message', { content, type });
    } else {
      socket.emit('send_private_message', { receiverId: chatUser.id, content, type });
    }
  }, [socket, isGlobal, chatUser]);

  const handleTyping = useCallback((stop = false) => {
    if (!socket) return;
    if (stop) {
      socket.emit('stop_typing', isGlobal ? { room: 'global' } : { receiverId: chatUser?.id });
    } else {
      socket.emit('typing', isGlobal ? { room: 'global' } : { receiverId: chatUser?.id });
    }
  }, [socket, isGlobal, chatUser]);

  const handleAdminDelete = useCallback(async (msgId) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      await api.delete(`/api/admin/messages/${msgId}`);
    } catch {}
  }, []);

  const isMuted = user.muted && (!user.mute_until || user.mute_until > Date.now());
  const grouped = groupMessages(messages);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0
      }}>
        {isGlobal ? (
          <>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid var(--border)' }}>🌐</div>
            <div>
              <div style={{ fontWeight: 600 }}>Chat Global</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Discussion ouverte à tous les membres</div>
            </div>
          </>
        ) : (
          <>
            <Avatar user={chatUser} size={36} />
            <div>
              <div style={{ fontWeight: 600 }}>{chatUser?.username}</div>
              {chatUser?.bio && <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatUser.bio}</div>}
            </div>
            {chatUser?.role === 'admin' && (
              <span className="badge badge-admin" style={{ marginLeft: 4 }}>Admin</span>
            )}
          </>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
            <div className="spinner" />
            <span>Chargement des messages…</span>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)', padding: 32 }}>
            <span style={{ fontSize: 48 }}>{isGlobal ? '🌐' : '💬'}</span>
            <p style={{ textAlign: 'center', maxWidth: 300 }}>
              {isGlobal ? 'Soyez le premier à écrire dans le chat global !' : `Commencez une conversation avec ${chatUser?.username} !`}
            </p>
          </div>
        ) : (
          <>
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
                />
              )
            )}
          </>
        )}

        {/* Typing indicator */}
        {typing.length > 0 && (
          <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {typing.join(', ')} écrit{typing.length > 1 ? 'ent' : ''}…
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Muted banner */}
      {isMuted && (
        <div className="alert alert-warning" style={{ margin: '0 16px 8px', borderRadius: 8 }}>
          🔇 Vous êtes actuellement muet(te).
          {user.mute_until ? ` Jusqu'au ${new Date(user.mute_until).toLocaleString('fr-FR')}.` : ' (permanent)'}
        </div>
      )}

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onTyping={handleTyping}
        disabled={isMuted}
        placeholder={isGlobal ? 'Message dans le chat global…' : `Message privé à ${chatUser?.username}…`}
      />
    </div>
  );
}
