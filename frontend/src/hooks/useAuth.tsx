'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, AuthSession } from '@/types';
import { auth as authApi, getSession, clearSession, profiles } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, displayName: string, avatarUrl?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { display_name?: string; bio?: string; avatar_url?: string }) => Promise<void>;
  isAdmin: boolean;
  isRegistered: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getSession();
    setSession(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const s = await authApi.login(email, password);
    setSession(s);
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    username: string,
    displayName: string,
    avatarUrl?: string
  ) => {
    await authApi.register(email, password, username, displayName);

    // If avatar was uploaded, update profile after registration
    // (profile is created during register, avatar can be patched after login)
    if (avatarUrl) {
      // Store avatar url temporarily to apply after email confirmation + login
      localStorage.setItem('pending_avatar', avatarUrl);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const updateProfile = useCallback(async (data: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
  }) => {
    const updated = await profiles.update(data);
    // Update session with new profile data
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        user: { ...prev.user, ...updated },
      };
    });
  }, []);

  // After login, apply pending avatar if any
  useEffect(() => {
    const pendingAvatar = localStorage.getItem('pending_avatar');
    if (session && pendingAvatar) {
      localStorage.removeItem('pending_avatar');
      profiles.update({ avatar_url: pendingAvatar }).then(updated => {
        setSession(prev => {
          if (!prev) return prev;
          return { ...prev, user: { ...prev.user, ...updated } };
        });
      }).catch(() => {});
    }
  }, [session?.user?.id]);

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      isAdmin: user?.role === 'admin',
      isRegistered: user?.role === 'registered' || user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}