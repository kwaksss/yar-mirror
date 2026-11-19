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

/**
 * Runs the provider's authorization-code flow in the system browser and returns
 * the code for the backend to exchange. The app never handles provider tokens.
 */
export async function authorize(provider: SocialProvider): Promise<AuthorizationResult> {
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
