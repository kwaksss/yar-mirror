import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchMe, loginWithProvider, type UserProfile } from '../api/auth';
import { authorize, type SocialProvider } from './oauth';
import { setSessionTokens, subscribeToSession } from './session';
import { clearTokens, loadTokens, saveTokens } from './tokenStorage';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthContextValue = {
  status: AuthStatus;
  user: UserProfile | null;
  signIn: (provider: SocialProvider) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await loadTokens().catch(() => null);
      if (cancelled) return;
      setSessionTokens(stored);
      setStatus(stored ? 'authenticated' : 'unauthenticated');
      if (!stored) return;

      // Best effort: a restored session should not be held at a spinner just
      // because the profile call is slow or offline.
      const profile = await fetchMe().catch(() => null);
      if (!cancelled) setUser(profile);
    })();

    const unsubscribe = subscribeToSession((tokens) => {
      if (cancelled) return;
      if (!tokens) {
        setUser(null);
        setStatus('unauthenticated');
      } else {
        setStatus('authenticated');
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (provider: SocialProvider) => {
    const authorization = await authorize(provider);
    const response = await loginWithProvider(provider, authorization);
    const tokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    };
    await saveTokens(tokens);
    setSessionTokens(tokens);
    setUser(await fetchMe().catch(() => null));
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    setSessionTokens(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within an AuthProvider');
  return value;
}
