import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { fetchMe } from '../api/auth';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('../api/auth', () => ({
  fetchMe: jest.fn(),
  loginWithProvider: jest.fn(),
}));

const mockedFetchMe = fetchMe as jest.MockedFunction<typeof fetchMe>;
import { initialRouteFor } from '../navigation/routing';
import { resetSessionForTests, getSessionTokens } from './session';

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

const storedTokens: Record<string, string> = {
  'mirrorspot.accessToken': 'stored-access',
  'mirrorspot.refreshToken': 'stored-refresh',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider boot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionForTests();
    mockedFetchMe.mockResolvedValue({ id: 7, nickname: '민지', provider: 'kakao' });
  });

  it('lands on Map without showing Login when SecureStore holds a session', async () => {
    mockedSecureStore.getItemAsync.mockImplementation(async (key) => storedTokens[key] ?? null);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    expect(initialRouteFor(result.current.status)).toBe('Map');
    expect(getSessionTokens()).toEqual({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
    });

    await waitFor(() => expect(result.current.user?.nickname).toBe('민지'));
  });

  it('enters the map even when the profile call fails on a restored session', async () => {
    mockedSecureStore.getItemAsync.mockImplementation(async (key) => storedTokens[key] ?? null);
    mockedFetchMe.mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(initialRouteFor(result.current.status)).toBe('Map');
    expect(result.current.user).toBeNull();
  });

  it('stays on Login when no session is stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    expect(initialRouteFor(result.current.status)).toBe('Login');
    expect(getSessionTokens()).toBeNull();
  });

  it('stays on Login when only a partial token pair survives', async () => {
    mockedSecureStore.getItemAsync.mockImplementation(async (key) =>
      key === 'mirrorspot.accessToken' ? 'stored-access' : null,
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(initialRouteFor(result.current.status)).toBe('Login');
  });

  it('drops back to Login when the session is cleared by a failed refresh', async () => {
    mockedSecureStore.getItemAsync.mockImplementation(async (key) => storedTokens[key] ?? null);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.signOut();
    });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(initialRouteFor(result.current.status)).toBe('Login');
  });
});
