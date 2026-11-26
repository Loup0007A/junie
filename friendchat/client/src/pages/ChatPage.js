/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket, useAuth, api } from '../hooks/useContexts';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import FunEffects from '../components/FunEffects';
import RimbaudGame from '../components/RimbaudGame';
import ProfileCard from '../components/ProfileCard';
import PenduGame from '../components/PenduGame';
import PoemReader from '../components/PoemReader';
import { BellRing, X } from 'lucide-react';
import { mentionsUser } from '../components/MessageBubble';
import { playPing, showNotification, setFaviconBadge } from '../hooks/notify';

// Strip markdown/HTML-ish noise for notification bodies
const plain = (msg) => msg.type === 'text'
  ? msg.content.replace(/<[^>]+>/g, '').replace(/[*~`>]/g, '')
  : msg.type === 'gif' ? 'GIF' : msg.type === 'poll' ? `Sondage : ${msg.content}` : 'Image';

export default function ChatPage() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState('global');
  const [chatUser, setChatUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [chatClearedTs, setChatClearedTs] = useState(null);
  const [hiddenUnread, setHiddenUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const dnd = user.presence === 'dnd';
  const baseTitle = useRef(document.title);

  useEffect(() => {
    api.get('/api/messages/unread').then(r => {
      const counts = {};
      r.data.forEach(item => { counts[item.sender_id] = item.count; });
      setUnreadCounts(counts);
    }).catch(() => {});
  }, []);

  // Tab title + favicon badge: messages received in the background and unread private messages
  const unreadPMs = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  useEffect(() => {
    document.title = hiddenUnread > 0 ? `(${hiddenUnread}) ${baseTitle.current}` : baseTitle.current;
    setFaviconBadge(hiddenUnread + unreadPMs);
  }, [hiddenUnread, unreadPMs]);
  useEffect(() => () => setFaviconBadge(0), []);
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) setHiddenUnread(0); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); document.title = baseTitle.current; };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewPM = (msg) => {
      if (msg.sender_id === user.id) return;
      const viewing = activeChat === `pm-${msg.sender_id}`;
      if (!viewing) {
        setUnreadCounts(prev => ({
          ...prev,
          [msg.sender_id]: (prev[msg.sender_id] || 0) + 1
        }));
      }
      if ((!viewing || document.hidden) && !dnd) {
        playPing();
        showNotification(`${msg.sender_name} (message privé)`, plain(msg));
      }
      if (document.hidden) setHiddenUnread(n => n + 1);
    };
    const handleNewGlobal = (msg) => {
      if (msg.sender_id === user.id || msg.sender_id === 'system') return;
      const mentioned = msg.type === 'text' && mentionsUser(msg.content, user.username);
      if (mentioned && !dnd) {
        playPing();
        showNotification(`${msg.sender_name} t'a mentionné`, plain(msg), () => { setActiveChat('global'); setChatUser(null); });
      }
      if (document.hidden) setHiddenUnread(n => n + 1);
    };
    // Reminders (/rappel): shown even in "do not disturb" — you asked for them
    const handleReminder = (r) => {
      setReminders(prev => [...prev.filter(x => x.id !== r.id), r]);
      playPing();
      showNotification('Rappel', r.text);
    };
    socket.on('reminder', handleReminder);
    socket.on('new_private_message', handleNewPM);
    socket.on('new_global_message', handleNewGlobal);
    return () => {
      socket.off('reminder', handleReminder);
      socket.off('new_private_message', handleNewPM);
      socket.off('new_global_message', handleNewGlobal);
    };
  }, [socket, activeChat, user.id, user.username, dnd]);

  const handleSelectChat = (id, user = null) => {
    setActiveChat(id);
    setChatUser(user);
    if (id.startsWith('pm-') && user) {
      setUnreadCounts(prev => ({ ...prev, [user.id]: 0 }));
    }
  };

  const handleChatCleared = useCallback(() => {
    setChatClearedTs(Date.now());
  }, []);

  return (
    <div className="app-container">
      <Sidebar
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        unreadCounts={unreadCounts}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <ChatWindow
        key={activeChat}
        chatId={activeChat}
        chatUser={chatUser}
        clearedTs={chatClearedTs}
        onOpenMenu={() => setDrawerOpen(true)}
        menuBadge={Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
      />
      <ProfileCard onMessage={(u) => handleSelectChat(`pm-${u.id}`, u)} />
      <FunEffects onChatCleared={handleChatCleared} />
      <div className="game-dock">
        <RimbaudGame />
        <PenduGame />
      </div>
      <PoemReader />
      {reminders.length > 0 && (
        <div className="reminder-stack" role="status">
          {reminders.map(r => (
            <div key={r.id} className="reminder-toast">
              <BellRing size={18} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Rappel{r.late ? ' (pendant ton absence)' : ''}</div>
                <div style={{ fontSize: 14, wordBreak: 'break-word' }}>{r.text}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setReminders(prev => prev.filter(x => x.id !== r.id))} aria-label="Fermer le rappel"><X size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
