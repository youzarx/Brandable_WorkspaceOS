'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthenticatedUser } from '@platform/types';
import type { LoginInput, RegisterInput } from '@platform/validation';
import { api, setInMemoryAccessToken } from '../lib/api';

interface AuthContextType {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateAccessToken = useCallback((token: string | null) => {
    setInMemoryAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await api.post<{ accessToken: string; user: AuthenticatedUser }>(
        '/auth/refresh',
        {},
        { skipAuth: true, skipRetry: true },
      );
      if (res?.accessToken) {
        updateAccessToken(res.accessToken);
        if (res.user) {
          setUser(res.user);
        }
        return true;
      }
      updateAccessToken(null);
      setUser(null);
      return false;
    } catch {
      updateAccessToken(null);
      setUser(null);
      return false;
    }
  }, [updateAccessToken]);

  const loadMe = useCallback(async () => {
    try {
      const meData = await api.get<AuthenticatedUser>('/auth/me');
      if (meData) {
        setUser(meData);
      }
    } catch {
      // If /auth/me fails, attempt refresh
      const refreshed = await refreshSession();
      if (!refreshed) {
        setUser(null);
        updateAccessToken(null);
      }
    }
  }, [refreshSession, updateAccessToken]);

  // Initial auth check on mount
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const ok = await refreshSession();
        if (ok && isMounted) {
          await loadMe();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [refreshSession, loadMe]);

  const login = async (input: LoginInput): Promise<void> => {
    const res = await api.post<{ accessToken: string; user: AuthenticatedUser }>(
      '/auth/login',
      input,
      { skipAuth: true },
    );
    updateAccessToken(res.accessToken);
    setUser(res.user);
  };

  const register = async (input: RegisterInput): Promise<void> => {
    const res = await api.post<{ accessToken: string; user: AuthenticatedUser }>(
      '/auth/register',
      input,
      { skipAuth: true },
    );
    updateAccessToken(res.accessToken);
    setUser(res.user);
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout', {}, { skipRetry: true });
    } catch {
      // Ignore logout API failures
    } finally {
      updateAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user && !!accessToken,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
