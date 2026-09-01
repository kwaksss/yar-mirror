import Constants from 'expo-constants';

export type AppExtra = {
  apiBaseUrl: string;
  kakaoJsKey: string;
  kakaoRestApiKey: string;
  googleClientId: string;
};

const DEFAULTS: AppExtra = {
  apiBaseUrl: 'http://localhost:8080',
  kakaoJsKey: '',
  kakaoRestApiKey: '',
  googleClientId: '',
};

export function getAppExtra(): AppExtra {
  const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppExtra>;
  return {
    apiBaseUrl: extra.apiBaseUrl || DEFAULTS.apiBaseUrl,
    kakaoJsKey: extra.kakaoJsKey || DEFAULTS.kakaoJsKey,
    kakaoRestApiKey: extra.kakaoRestApiKey || DEFAULTS.kakaoRestApiKey,
    googleClientId: extra.googleClientId || DEFAULTS.googleClientId,
  };
}
