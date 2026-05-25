import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile } from '../lib/firebaseServices';
import type { UserProfile, UserRole } from '../types';

const ROLE_STORAGE_KEY = 'helpboard_role';

function getStoredRole(): UserRole | null {
  try {
    const stored = localStorage.getItem(ROLE_STORAGE_KEY);
    if (stored === 'client' || stored === 'helper') return stored;
  } catch {}
  return null;
}

function storeRole(role: UserRole) {
  try { localStorage.setItem(ROLE_STORAGE_KEY, role); } catch {}
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  role: UserRole;
  setRole: (role: UserRole) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  role: 'helper',
  setRole: () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>(() => getStoredRole() || 'helper');

  // Persist role changes to localStorage immediately
  const handleSetRole = useCallback((newRole: UserRole) => {
    setRole(newRole);
    storeRole(newRole);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (currentUser) {
      const profile = await getUserProfile(currentUser.uid);
      setUserProfile(profile);
      // Only reset role from profile if no stored preference
      if (profile && !getStoredRole()) {
        setRole(profile.role);
        storeRole(profile.role);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
        // Restore role: prefer localStorage, fall back to profile.role
        const storedRole = getStoredRole();
        if (storedRole) {
          setRole(storedRole);
        } else if (profile) {
          setRole(profile.role);
          storeRole(profile.role);
        }
      } else {
        setUserProfile(null);
        const storedRole = getStoredRole();
        setRole(storedRole || 'helper');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    role,
    setRole: handleSetRole,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
