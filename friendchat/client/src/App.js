/* eslint-disable */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, SocketProvider, useAuth } from './hooks/useContexts';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import ChangePasswordModal from './components/ChangePasswordModal';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      <span>Connexion en cours…</span>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/chat" replace />;

  // Force password change before accessing anything
  if (user.mustChangePassword) {
    return <ChangePasswordModal forced={true} onClose={() => {}} />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      <span>Chargement…</span>
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/chat" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/chat" replace /> : <RegisterPage />} />
      <Route path="/chat/*" element={
        <ProtectedRoute>
          <SocketProvider>
            <ChatPage />
          </SocketProvider>
        </ProtectedRoute>
      } />
      <Route path="/admin/*" element={
        <ProtectedRoute adminOnly>
          <SocketProvider>
            <AdminPage />
          </SocketProvider>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to={user ? "/chat" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
