import { apiClient } from './client';
import type { AuthTokens } from '../auth/tokenStorage';
import type { AuthorizationResult, SocialProvider } from '../auth/oauth';

/** Mirrors the backend TokenResponse. */
export type LoginResponse = AuthTokens & {
  tokenType: string;
  expiresIn: number;
};

export type UserProfile = {
  id: number;
  nickname: string;
  provider: SocialProvider;
};

/** Backend MeResponse — provider is the uppercase enum name. */
type MeResponse = {
  id: number;
  nickname: string;
  provider: string;
};

export function loginWithProvider(
  provider: SocialProvider,
  authorization: AuthorizationResult,
): Promise<LoginResponse> {
  return apiClient
    .post<LoginResponse>(`/auth/login/${provider}`, {
      authorizationCode: authorization.code,
      redirectUri: authorization.redirectUri,
      codeVerifier: authorization.codeVerifier ?? null,
    })
    .then((res) => res.data);
}

export function fetchMe(): Promise<UserProfile> {
  return apiClient.get<MeResponse>('/auth/me').then(({ data }) => ({
    id: data.id,
    nickname: data.nickname,
    provider: data.provider.toLowerCase() as SocialProvider,
  }));
}
