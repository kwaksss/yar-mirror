import { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type * as SessionModule from '../auth/session';
import type * as SecureStoreModule from 'expo-secure-store';

type Adapter = jest.Mock<Promise<any>, [InternalAxiosRequestConfig]>;

type Harness = {
  apiClient: AxiosInstance;
  session: typeof SessionModule;
  secureStore: jest.Mocked<typeof SecureStoreModule>;
};

function response(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  return { data, status, statusText: '', headers: {}, config };
}

function reject(config: InternalAxiosRequestConfig, status: number) {
  return Promise.reject(
    new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_REQUEST,
      config,
      null,
      response(config, status, {}) as any,
    ),
  );
}

/**
 * The interceptor lives on module-level axios instances, so each case loads a
 * fresh copy of the module graph with a stubbed adapter underneath axios.
 */
function load(adapter: Adapter): Harness {
  let harness: Harness | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const axiosModule = require('axios').default;
    axiosModule.defaults.adapter = adapter;
    harness = {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      apiClient: require('./client').apiClient,
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      session: require('../auth/session'),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      secureStore: require('expo-secure-store'),
    };
  });
  return harness!;
}

const authHeaderOf = (config: InternalAxiosRequestConfig) =>
  String(config.headers.Authorization ?? config.headers.get?.('Authorization') ?? '');

describe('apiClient 401 handling', () => {
  it('refreshes the access token and replays the original request', async () => {
    const seen: InternalAxiosRequestConfig[] = [];
    const adapter: Adapter = jest.fn(async (config) => {
      seen.push(config);
      if (config.url === '/auth/refresh') {
        return response(config, 200, { accessToken: 'new-access', refreshToken: 'new-refresh' });
      }
      if (authHeaderOf(config) === 'Bearer stale-access') {
        return reject(config, 401);
      }
      return response(config, 200, { ok: true });
    });

    const { apiClient, session, secureStore } = load(adapter);
    session.setSessionTokens({ accessToken: 'stale-access', refreshToken: 'refresh-token' });

    const result = await apiClient.get('/spots');

    expect(result.data).toEqual({ ok: true });
    expect(seen.map((c) => c.url)).toEqual(['/spots', '/auth/refresh', '/spots']);
    expect(authHeaderOf(seen[2])).toBe('Bearer new-access');
    expect(session.getSessionTokens()).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'mirrorspot.accessToken',
      'new-access',
    );
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'mirrorspot.refreshToken',
      'new-refresh',
    );
  });

  it('retries only once so a still-401 response does not loop', async () => {
    const seen: InternalAxiosRequestConfig[] = [];
    const adapter: Adapter = jest.fn(async (config) => {
      seen.push(config);
      if (config.url === '/auth/refresh') {
        return response(config, 200, { accessToken: 'new-access', refreshToken: 'new-refresh' });
      }
      return reject(config, 401);
    });

    const { apiClient, session } = load(adapter);
    session.setSessionTokens({ accessToken: 'stale-access', refreshToken: 'refresh-token' });

    await expect(apiClient.get('/spots')).rejects.toBeInstanceOf(AxiosError);
    expect(seen.map((c) => c.url)).toEqual(['/spots', '/auth/refresh', '/spots']);
  });

  it('clears the session when the refresh call itself fails', async () => {
    const adapter: Adapter = jest.fn(async (config) => reject(config, 401));

    const { apiClient, session, secureStore } = load(adapter);
    const sessionChanges: unknown[] = [];
    session.subscribeToSession((tokens) => sessionChanges.push(tokens));
    session.setSessionTokens({ accessToken: 'stale-access', refreshToken: 'refresh-token' });

    await expect(apiClient.get('/spots')).rejects.toBeInstanceOf(AxiosError);

    expect(session.getSessionTokens()).toBeNull();
    expect(sessionChanges[sessionChanges.length - 1]).toBeNull();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('mirrorspot.accessToken');
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('mirrorspot.refreshToken');
  });

  it('does not attempt a refresh when there is no stored session', async () => {
    const seen: InternalAxiosRequestConfig[] = [];
    const adapter: Adapter = jest.fn(async (config) => {
      seen.push(config);
      return reject(config, 401);
    });

    const { apiClient } = load(adapter);

    await expect(apiClient.get('/spots')).rejects.toBeInstanceOf(AxiosError);
    expect(seen.map((c) => c.url)).toEqual(['/spots']);
  });
});
