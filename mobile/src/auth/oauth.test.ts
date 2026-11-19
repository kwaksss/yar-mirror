import type * as AuthSession from 'expo-auth-session';
import type * as OAuth from './oauth';

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('../config/env', () => ({
  getAppExtra: () => ({
    apiBaseUrl: 'https://api.example.com',
    kakaoJsKey: 'js-key',
    kakaoRestApiKey: 'rest-key',
    googleClientId: '',
  }),
}));

type FakeRequest = {
  codeVerifier: string;
  url?: string;
  // promptAsync 가 불린 순간 url 이 이미 있었는지. 없으면 실제 promptAsync 는 await 로 URL 을 만든 뒤 팝업을 연다.
  urlAtPrompt?: string;
  makeAuthUrlAsync: jest.Mock;
  promptAsync: jest.Mock;
};

let created: FakeRequest[];

// oauth 모듈은 준비된 요청을 모듈 상태로 들고 있으므로 테스트마다 새로 불러온다.
// 같은 격리 레지스트리에서 expo-auth-session 목도 같이 불러와야 oauth 가 쓰는 목을 설정할 수 있다.
function load(): typeof OAuth {
  let mod: typeof OAuth | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const session = require('expo-auth-session') as typeof AuthSession;
    stubAuthRequest(session.AuthRequest as unknown as jest.Mock);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('./oauth');
  });
  return mod!;
}

beforeEach(() => {
  created = [];
});

function stubAuthRequest(AuthRequestMock: jest.Mock) {
  AuthRequestMock.mockReset();
  AuthRequestMock.mockImplementation(() => {
    const request: FakeRequest = {
      codeVerifier: `verifier-${created.length + 1}`,
      makeAuthUrlAsync: jest.fn(async () => {
        request.url = 'https://kauth.kakao.com/oauth/authorize?x';
        return request.url;
      }),
      promptAsync: jest.fn(async () => {
        request.urlAtPrompt = request.url;
        return { type: 'success', params: { code: 'the-code' } };
      }),
    };
    created.push(request);
    return request;
  });
}

/**
 * Mobile browsers block window.open unless it runs in the same task as the tap.
 * promptAsync builds the PKCE URL with an await before opening the popup, so the
 * login screen prepares the URL ahead of time and authorize must reach
 * promptAsync without awaiting anything first.
 */
describe('authorize', () => {
  it('opens the prepared request synchronously after prepareAuthorization', async () => {
    const oauth = load();
    await oauth.prepareAuthorization('kakao');
    expect(created).toHaveLength(1);
    expect(created[0].makeAuthUrlAsync).toHaveBeenCalledTimes(1);

    const result = oauth.authorize('kakao');
    // No await yet: the popup must already have been requested, with the URL already built.
    expect(created[0].promptAsync).toHaveBeenCalledTimes(1);
    expect(created[0].urlAtPrompt).toBe('https://kauth.kakao.com/oauth/authorize?x');

    await expect(result).resolves.toEqual({
      code: 'the-code',
      redirectUri: 'mirrorspot://redirect',
      codeVerifier: 'verifier-1',
    });
  });

  it('uses a prepared request only once so state and code_verifier are not reused', async () => {
    const oauth = load();
    await oauth.prepareAuthorization('kakao');
    await oauth.authorize('kakao');
    await oauth.authorize('kakao');

    expect(created).toHaveLength(2);
    expect(created[0].promptAsync).toHaveBeenCalledTimes(1);
    expect(created[1].promptAsync).toHaveBeenCalledTimes(1);
  });

  it('does not create a second request when prepared twice', async () => {
    const oauth = load();
    await Promise.all([oauth.prepareAuthorization('kakao'), oauth.prepareAuthorization('kakao')]);
    await oauth.prepareAuthorization('kakao');
    expect(created).toHaveLength(1);
  });

  it('still works without preparation (native path)', async () => {
    const oauth = load();
    await expect(oauth.authorize('kakao')).resolves.toMatchObject({ code: 'the-code' });
    expect(created).toHaveLength(1);
    expect(created[0].urlAtPrompt).toBeUndefined();
  });

  it('throws a config error when the client id is missing', async () => {
    const oauth = load();
    await expect(oauth.authorize('google')).rejects.toBeInstanceOf(oauth.OAuthConfigError);
  });
});
