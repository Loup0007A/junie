/* eslint-disable */
import React, { useState, useEffect, useCallback } from 'react';
import { useSocket, api } from '../hooks/useContexts';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import FunEffects from '../components/FunEffects';

export default function ChatPage() {
  const { socket } = useSocket();
  const [activeChat, setActiveChat] = useState('global');
  const [chatUser, setChatUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [chatClearedTs, setChatClearedTs] = useState(null);

  useEffect(() => {
    api.get('/api/messages/unread').then(r => {
      const counts = {};
      r.data.forEach(item => { counts[item.sender_id] = item.count; });
      setUnreadCounts(counts);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewPM = (msg) => {
      if (activeChat !== `pm-${msg.sender_id}`) {
        setUnreadCounts(prev => ({
          ...prev,
          [msg.sender_id]: (prev[msg.sender_id] || 0) + 1
        }));
      }
    };
    socket.on('new_private_message', handleNewPM);
    return () => socket.off('new_private_message', handleNewPM);
  }, [socket, activeChat]);

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
    </div>
  );
}
