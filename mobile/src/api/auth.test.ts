import type { InternalAxiosRequestConfig } from 'axios';
import type * as AuthApi from './auth';

type Adapter = jest.Mock<Promise<any>, [InternalAxiosRequestConfig]>;

function load(adapter: Adapter): typeof AuthApi {
  let mod: typeof AuthApi | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const axiosModule = require('axios').default;
    axiosModule.defaults.adapter = adapter;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('./auth');
  });
  return mod!;
}

const ok = (config: InternalAxiosRequestConfig, data: unknown) =>
  Promise.resolve({ data, status: 200, statusText: '', headers: {}, config });

/**
 * Field names here are pinned against backend auth/dto/LoginRequest.java and
 * auth/dto/MeResponse.java. Sending `code` instead of `authorizationCode` left
 * the backend with a null code and 401'd every login.
 */
describe('loginWithProvider', () => {
  it('sends the authorizationCode field the backend LoginRequest declares', async () => {
    let sent: InternalAxiosRequestConfig | undefined;
    const adapter: Adapter = jest.fn(async (config) => {
      sent = config;
      return ok(config, {
        accessToken: 'a',
        refreshToken: 'r',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
    });

    const { loginWithProvider } = load(adapter);
    const tokens = await loginWithProvider('kakao', {
      code: 'auth-code-123',
      redirectUri: 'mirrorspot://redirect',
      codeVerifier: 'verifier-abc',
    });

    expect(sent?.url).toBe('/auth/login/kakao');
    expect(JSON.parse(String(sent?.data))).toEqual({
      authorizationCode: 'auth-code-123',
      redirectUri: 'mirrorspot://redirect',
      codeVerifier: 'verifier-abc',
    });
    expect(JSON.parse(String(sent?.data))).not.toHaveProperty('code');
    expect(tokens).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
  });

  it('sends an explicit null codeVerifier when PKCE was not used', async () => {
    let sent: InternalAxiosRequestConfig | undefined;
    const adapter: Adapter = jest.fn(async (config) => {
      sent = config;
      return ok(config, { accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer', expiresIn: 1 });
    });

    const { loginWithProvider } = load(adapter);
    await loginWithProvider('google', {
      code: 'auth-code-123',
      redirectUri: 'mirrorspot://redirect',
    });

    expect(JSON.parse(String(sent?.data)).codeVerifier).toBeNull();
  });
});

describe('fetchMe', () => {
  it('lowercases the uppercase provider enum the backend emits', async () => {
    const adapter: Adapter = jest.fn(async (config) =>
      ok(config, { id: 7, nickname: '민지', provider: 'KAKAO' }),
    );

    const { fetchMe } = load(adapter);

    await expect(fetchMe()).resolves.toEqual({
      id: 7,
      nickname: '민지',
      provider: 'kakao',
    });
  });

  it('maps GOOGLE the same way and keeps the numeric id', async () => {
    const adapter: Adapter = jest.fn(async (config) =>
      ok(config, { id: 12, nickname: 'jun', provider: 'GOOGLE' }),
    );

    const { fetchMe } = load(adapter);
    const profile = await fetchMe();

    expect(profile.provider).toBe('google');
    expect(profile.id).toBe(12);
  });
});
