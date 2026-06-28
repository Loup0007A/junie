import React, { useState, useEffect } from 'react';
import { useSocket, api } from '../hooks/useContexts';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

export default function ChatPage() {
  const { socket } = useSocket();
  const [activeChat, setActiveChat] = useState('global');
  const [chatUser, setChatUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Load initial unread counts
  useEffect(() => {
    api.get('/api/messages/unread').then(r => {
      const counts = {};
      r.data.forEach(item => { counts[item.sender_id] = item.count; });
      setUnreadCounts(counts);
    }).catch(() => {});
  }, []);

  // Listen for new private messages to update unread counts
  useEffect(() => {
    if (!socket) return;
    const handleNewPM = (msg) => {
      // Only count if not currently viewing this conversation
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
    // Clear unread for this user
    if (id.startsWith('pm-') && user) {
      setUnreadCounts(prev => ({ ...prev, [user.id]: 0 }));
    }
  };

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
      />
    </div>
  );
}
