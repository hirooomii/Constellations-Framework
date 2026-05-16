'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { AuthUser, AuthSession } from '@/types';
import { auth as authApi, getSession, clearSession } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

  const register = useCallback(async (email: string, password: string) => {
    await authApi.register(email, password);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      login,
      register,
      logout,
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
