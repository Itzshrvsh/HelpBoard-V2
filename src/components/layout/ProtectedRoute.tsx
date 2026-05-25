import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingScreen from '../ui/LoadingScreen';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading, userProfile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (userProfile?.isBlocked) return <Navigate to="/blocked" replace />;

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading, userProfile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!currentUser) return <Navigate to="/admin/login" replace />;
  if (!userProfile?.isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (currentUser) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
