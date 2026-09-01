import * as AuthSession from 'expo-auth-session';
import { getAppExtra } from '../config/env';

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
