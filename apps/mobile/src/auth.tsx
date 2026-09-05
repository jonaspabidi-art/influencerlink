import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAccessToken, setUnauthorizedHandler } from './api';
import { getItem, removeItem, setItem } from './storage';
import type { SessionUser } from './types';

const TOKEN_KEY = 'pacta.session';

interface AuthState {
  user: SessionUser | null;
  /** Sant tills den sparade sessionen har lästs in från enheten. */
  loading: boolean;
  signIn: (token: string, user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
  /** Läser om användaren från servern, t.ex. efter avslutad onboarding. */
  refresh: () => Promise<void>;
  /** Byter till en färsk token, som servern ger efter profilsparande. */
  replaceToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    setAccessToken(null);
    setUser(null);
    await removeItem(TOKEN_KEY);
  }, []);

  const refresh = useCallback(async () => {
    const me = await api.get<SessionUser>('/auth/me');
    setUser(me);
  }, []);

  const signIn = useCallback(async (token: string, nextUser: SessionUser) => {
    setAccessToken(token);
    await setItem(TOKEN_KEY, token);
    setUser(nextUser);
  }, []);

  const replaceToken = useCallback(async (token: string) => {
    setAccessToken(token);
    await setItem(TOKEN_KEY, token);
  }, []);

  useEffect(() => {
    // En utgången token ska inte lämna appen i ett halvinloggat läge.
    setUnauthorizedHandler(() => {
      void signOut();
    });
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getItem(TOKEN_KEY);
        if (!stored) return;
        setAccessToken(stored);
        const me = await api.get<SessionUser>('/auth/me');
        if (!cancelled) setUser(me);
      } catch {
        // Trasig eller för gammal token: börja om med utloggat läge.
        setAccessToken(null);
        await removeItem(TOKEN_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signOut, refresh, replaceToken }),
    [user, loading, signIn, signOut, refresh, replaceToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth måste användas inuti AuthProvider');
  return context;
}
