import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import type { AuthUser } from '../shared/types';

export type AppView =
  | 'landing'
  | 'explore'
  | 'auth'
  | 'dashboard'
  | 'players'
  | 'connection'
  | 'tournaments'
  | 'communities'
  | 'opportunities'
  | 'profile'
  | 'admin';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  view: AppView;
  authMode: 'login' | 'signup' | 'forgot';
  selectedUsername: string | null;
  navigate: (view: AppView, opts?: { authMode?: 'login' | 'signup' | 'forgot'; username?: string }) => void;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (payload: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    country: string;
    city: string;
    favoriteGames: string[];
    gamingPlatform: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const VALID_VIEWS: AppView[] = [
  'landing',
  'explore',
  'auth',
  'dashboard',
  'players',
  'connection',
  'tournaments',
  'communities',
  'opportunities',
  'profile',
  'admin',
];

function getInitialView(): AppView {
  if (typeof window === 'undefined') return 'landing';
  const hash = window.location.hash.replace('#', '') as AppView;
  return VALID_VIEWS.includes(hash) ? hash : 'landing';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>(getInitialView);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: AuthUser | null }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as AppView;
      if (VALID_VIEWS.includes(hash)) setView(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback(
    (nextView: AppView, opts?: { authMode?: 'login' | 'signup' | 'forgot'; username?: string }) => {
      if (opts?.authMode) setAuthMode(opts.authMode);
      if (opts?.username !== undefined) setSelectedUsername(opts.username);
      else if (nextView !== 'profile') setSelectedUsername(null);
      setView(nextView);
      if (typeof window !== 'undefined') {
        window.location.hash = nextView === 'landing' ? '' : `#${nextView}`;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(
    async (payload: {
      fullName: string;
      username: string;
      email: string;
      password: string;
      country: string;
      city: string;
      favoriteGames: string[];
      gamingPlatform: string;
    }) => {
      const data = await apiRequest<{ user: AuthUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setUser(data.user);
      return data.user;
    },
    []
  );

  const logout = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setView('landing');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        view,
        authMode,
        selectedUsername,
        navigate,
        refreshUser,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
