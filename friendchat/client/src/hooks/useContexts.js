/* eslint-disable */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);
const SocketContext = createContext(null);

// In production the server serves the React build on the same origin,
// so we use relative paths for API and the current window origin for socket.
const API_URL = process.env.REACT_APP_API_URL || '';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');

// Axios instance
const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('fc_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('fc_token'));

  useEffect(() => {
    if (token) {
      api.get('/api/auth/me')
        .then(r => setUser(r.data))
        .catch(() => { localStorage.removeItem('fc_token'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (username, password) => {
    const r = await api.post('/api/auth/login', { username, password });
    localStorage.setItem('fc_token', r.data.token);
    setToken(r.data.token);
    setUser(r.data.user);
    return r.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fc_token');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function SocketProvider({ children }) {
  const { token, user, logout, updateUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!token || !user) { setSocket(null); return; }

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    s.on('connect', () => console.log('🔌 Socket connected'));
    s.on('connect_error', (err) => {
      console.warn('Socket error:', err.message);
      if (err.message === 'Access denied' || err.message === 'Authentication required') {
        logout();
      }
    });
    s.on('online_users', (users) => setOnlineUsers(users));
    s.on('account_banned', () => {
      alert('Votre compte a été banni.');
      logout();
    });
    // Keep the mute banner in sync (manual mute by an admin or automatic antispam/insult mute)
    let unmuteTimer = null;
    const setMuted = (until) => {
      clearTimeout(unmuteTimer);
      updateUser({ muted: true, mute_until: until || null });
      if (until) unmuteTimer = setTimeout(() => updateUser({ muted: false, mute_until: null }), Math.max(0, until - Date.now()) + 500);
    };
    s.on('account_muted', ({ until }) => setMuted(until));
    s.on('muted', ({ until } = {}) => { if (until) setMuted(until); });
    s.on('account_unmuted', () => { clearTimeout(unmuteTimer); updateUser({ muted: false, mute_until: null }); });

    setSocket(s);
    return () => { clearTimeout(unmuteTimer); s.disconnect(); setSocket(null); };
  }, [token, user?.id]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const useSocket = () => useContext(SocketContext);
export { api };
