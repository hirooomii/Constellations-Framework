'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, AuthSession } from '@/types';
import { auth as authApi, getSession, clearSession, saveSession, profiles } from '@/lib/api';

interface UpdateProfileData {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  birthday?: string;
  zodiac_sign?: string;
  birthday_public?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, displayName: string, avatarUrl?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
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
    if (avatarUrl) {
      localStorage.setItem('pending_avatar', avatarUrl);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
    const updated = await profiles.update(data);

    setSession(prev => {
      if (!prev) return prev;

      const newUser: User = {
        ...prev.user,
        ...updated,
        // Explicitly sync all profile fields to session
        display_name:    data.display_name    ?? updated.display_name    ?? prev.user.display_name,
        bio:             data.bio             ?? updated.bio             ?? prev.user.bio,
        avatar_url:      data.avatar_url      ?? updated.avatar_url      ?? prev.user.avatar_url,
        birthday:        data.birthday        ?? updated.birthday        ?? prev.user.birthday,
        zodiac_sign:     data.zodiac_sign     ?? updated.zodiac_sign     ?? prev.user.zodiac_sign,
        birthday_public: data.birthday_public ?? updated.birthday_public ?? prev.user.birthday_public,
      };

      const newSession = { ...prev, user: newUser };
      saveSession(newSession); // ← persist to localStorage too!
      return newSession;
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
          const newSession = { ...prev, user: { ...prev.user, ...updated } };
          saveSession(newSession);
          return newSession;
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