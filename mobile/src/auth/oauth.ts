import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { getAppExtra } from '../config/env';

// 웹에서는 로그인이 팝업으로 열리고, 리다이렉트로 돌아온 팝업이 스스로 닫히면서 원래 창에 결과를 넘겨야 한다.
// 이 호출이 없으면 팝업이 남고 promptAsync가 끝나지 않는다. 네이티브에서는 아무 일도 하지 않는다.
WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'kakao' | 'google';

export type AuthorizationResult = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

const DISCOVERY: Record<SocialProvider, AuthSession.DiscoveryDocument> = {
  kakao: {
    authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
    tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
  },
  google: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
  },
};

const SCOPES: Record<SocialProvider, string[]> = {
  kakao: ['profile_nickname'],
  google: ['openid', 'profile', 'email'],
};

function clientIdFor(provider: SocialProvider): string {
  const extra = getAppExtra();
  return provider === 'kakao' ? extra.kakaoRestApiKey : extra.googleClientId;
}

export class OAuthConfigError extends Error {}
export class OAuthCancelledError extends Error {}

type PreparedRequest = { request: AuthSession.AuthRequest; redirectUri: string };

// 모바일 브라우저는 사용자 입력 직후에만 window.open 을 허용한다.
// promptAsync 가 인증 URL(PKCE)을 만드느라 await 하면 그 사이에 팝업이 차단되므로,
// 로그인 화면에 들어올 때 URL 을 미리 만들어 두고 버튼을 누르면 바로 팝업을 연다.
// state·code_verifier 는 한 번만 써야 하므로 꺼내 쓴 요청은 지운다.
// pending: 준비 중인 요청(중복 준비 방지), ready: 준비가 끝나 바로 꺼내 쓸 수 있는 요청
const pending = new Map<SocialProvider, Promise<void>>();
const ready = new Map<SocialProvider, PreparedRequest>();

function createRequest(provider: SocialProvider): PreparedRequest {
  const clientId = clientIdFor(provider);
  if (!clientId) {
    throw new OAuthConfigError(`${provider} client id is not configured`);
  }
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'mirrorspot' });
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: SCOPES[provider],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });
  return { request, redirectUri };
}

/** 로그인 버튼을 누르기 전에 인증 URL 을 미리 만들어 둔다. 실패해도 authorize 가 다시 만든다. */
export function prepareAuthorization(provider: SocialProvider): Promise<void> {
  if (ready.has(provider)) return Promise.resolve();
  let job = pending.get(provider);
  if (!job) {
    job = (async () => {
      const entry = createRequest(provider);
      await entry.request.makeAuthUrlAsync(DISCOVERY[provider]);
      ready.set(provider, entry);
    })().finally(() => pending.delete(provider));
    pending.set(provider, job);
  }
  return job;
}

// 준비가 끝난 요청만 동기적으로 꺼낸다. 여기서 await 하면 사용자 입력 맥락이 끊긴다.
function takeReady(provider: SocialProvider): PreparedRequest | undefined {
  const entry = ready.get(provider);
  ready.delete(provider);
  return entry;
}

/**
 * Runs the provider's authorization-code flow in the system browser and returns
 * the code for the backend to exchange. The app never handles provider tokens.
 */
export async function authorize(provider: SocialProvider): Promise<AuthorizationResult> {
  const { request, redirectUri } = takeReady(provider) ?? createRequest(provider);

  const result = await request.promptAsync(DISCOVERY[provider]);
  if (result.type !== 'success') {
    throw new OAuthCancelledError(`${provider} login was not completed (${result.type})`);
  }

  return {
    code: result.params.code,
    redirectUri,
    codeVerifier: request.codeVerifier,
  };
}
