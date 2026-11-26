/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket, useAuth, api } from '../hooks/useContexts';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import FunEffects from '../components/FunEffects';
import RimbaudGame from '../components/RimbaudGame';
import { mentionsUser } from '../components/MessageBubble';
import { playPing, showNotification } from '../hooks/notify';

// Strip markdown/HTML-ish noise for notification bodies
const plain = (msg) => msg.type === 'text'
  ? msg.content.replace(/<[^>]+>/g, '').replace(/[*~`>]/g, '')
  : msg.type === 'gif' ? '🎞️ GIF' : msg.type === 'poll' ? `📊 Sondage : ${msg.content}` : '📸 Image';

export default function ChatPage() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState('global');
  const [chatUser, setChatUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [chatClearedTs, setChatClearedTs] = useState(null);
  const [hiddenUnread, setHiddenUnread] = useState(0);
  const baseTitle = useRef(document.title);

  useEffect(() => {
    api.get('/api/messages/unread').then(r => {
      const counts = {};
      r.data.forEach(item => { counts[item.sender_id] = item.count; });
      setUnreadCounts(counts);
    }).catch(() => {});
  }, []);

  // Tab title badge while the page is in the background
  useEffect(() => {
    document.title = hiddenUnread > 0 ? `(${hiddenUnread}) ${baseTitle.current}` : baseTitle.current;
  }, [hiddenUnread]);
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
      if (!viewing || document.hidden) {
        playPing();
        showNotification(`💬 ${msg.sender_name}`, plain(msg));
      }
      if (document.hidden) setHiddenUnread(n => n + 1);
    };
    const handleNewGlobal = (msg) => {
      if (msg.sender_id === user.id || msg.sender_id === 'system') return;
      const mentioned = msg.type === 'text' && mentionsUser(msg.content, user.username);
      if (mentioned) {
        playPing();
        showNotification(`📣 ${msg.sender_name} t'a mentionné`, plain(msg), () => { setActiveChat('global'); setChatUser(null); });
      }
      if (document.hidden) setHiddenUnread(n => n + 1);
    };
    socket.on('new_private_message', handleNewPM);
    socket.on('new_global_message', handleNewGlobal);
    return () => {
      socket.off('new_private_message', handleNewPM);
      socket.off('new_global_message', handleNewGlobal);
    };
  }, [socket, activeChat, user.id, user.username]);

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
      />
      <ChatWindow
        key={activeChat}
        chatId={activeChat}
        chatUser={chatUser}
        clearedTs={chatClearedTs}
      />
      <FunEffects onChatCleared={handleChatCleared} />
      <RimbaudGame />
    </div>
  );
}
