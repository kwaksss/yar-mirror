package com.yarmirror.backend.auth;

/**
 * Mobile clients either complete the OAuth code flow themselves and pass the provider access token,
 * or hand the server an authorization code to exchange. {@code codeVerifier} carries the PKCE secret
 * the client generated; it must be forwarded on the token exchange or providers reject the code.
 */
public record OAuthLoginCommand(
        String authorizationCode, String accessToken, String redirectUri, String codeVerifier) {

    public boolean hasAccessToken() {
        return accessToken != null && !accessToken.isBlank();
    }

    public boolean hasAuthorizationCode() {
        return authorizationCode != null && !authorizationCode.isBlank();
    }

    public boolean hasCodeVerifier() {
        return codeVerifier != null && !codeVerifier.isBlank();
    }
}
