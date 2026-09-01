import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { getAppExtra } from '../config/env';
import { clearTokens, saveTokens, type AuthTokens } from '../auth/tokenStorage';
import { getSessionTokens, setSessionTokens } from '../auth/session';

type RetriableConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };

const clientOptions = { baseURL: getAppExtra().apiBaseUrl, timeout: 15000 };

export const apiClient: AxiosInstance = axios.create(clientOptions);

/**
 * Bare client for the refresh call itself — using `apiClient` here would make a
 * failing refresh re-enter the 401 interceptor.
 */
const refreshClient: AxiosInstance = axios.create(clientOptions);

let inFlightRefresh: Promise<AuthTokens | null> | null = null;

async function performRefresh(refreshToken: string): Promise<AuthTokens | null> {
  try {
    const { data } = await refreshClient.post<AuthTokens>('/auth/refresh', {
      refreshToken,
    });
    const tokens: AuthTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? refreshToken,
    };
    await saveTokens(tokens);
    setSessionTokens(tokens);
    return tokens;
  } catch {
    await clearTokens();
    setSessionTokens(null);
    return null;
  }
}

function refreshOnce(refreshToken: string): Promise<AuthTokens | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = performRefresh(refreshToken).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

apiClient.interceptors.request.use((config) => {
  const tokens = getSessionTokens();
  if (tokens?.accessToken) {
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const tokens = getSessionTokens();

    if (
      error.response?.status !== 401 ||
      !config ||
      config._retriedAfterRefresh ||
      !tokens?.refreshToken
    ) {
      return Promise.reject(error);
    }

    const refreshed = await refreshOnce(tokens.refreshToken);
    if (!refreshed) {
      // setSessionTokens(null) already fired; AuthProvider routes back to Login.
      return Promise.reject(error);
    }

    config._retriedAfterRefresh = true;
    config.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
    return apiClient.request(config);
  },
);
