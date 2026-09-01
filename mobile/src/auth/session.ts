import type { AuthTokens } from './tokenStorage';

type SessionListener = (tokens: AuthTokens | null) => void;

/**
 * Holds the in-memory tokens plus the "session expired" fan-out. Lives outside
 * React so the axios interceptor can read/refresh tokens without a hook.
 */
let current: AuthTokens | null = null;
const listeners = new Set<SessionListener>();

export function getSessionTokens(): AuthTokens | null {
  return current;
}

export function setSessionTokens(tokens: AuthTokens | null): void {
  current = tokens;
  listeners.forEach((listener) => listener(tokens));
}

export function subscribeToSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetSessionForTests(): void {
  current = null;
  listeners.clear();
}
