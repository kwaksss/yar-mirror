package com.yarmirror.backend.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.yarmirror.backend.config.OAuthProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

public abstract class AbstractOAuthProviderAdapter implements OAuthProviderAdapter {

    private final RestClient restClient;
    private final OAuthProperties.Provider config;

    protected AbstractOAuthProviderAdapter(RestClient restClient, OAuthProperties.Provider config) {
        this.restClient = restClient;
        this.config = config;
    }

    @Override
    public OAuthUserInfo fetchUserInfo(OAuthLoginCommand command) {
        String accessToken = command.hasAccessToken() ? command.accessToken() : exchangeAuthorizationCode(command);
        JsonNode body;
        try {
            body = restClient
                    .get()
                    .uri(config.userInfoUri())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            throw new OAuthAuthenticationException("failed to fetch user info from " + provider(), e);
        }
        if (body == null) {
            throw new OAuthAuthenticationException("empty user info response from " + provider());
        }
        return parseUserInfo(body);
    }

    protected abstract OAuthUserInfo parseUserInfo(JsonNode body);

    private String exchangeAuthorizationCode(OAuthLoginCommand command) {
        if (!command.hasAuthorizationCode()) {
            throw new OAuthAuthenticationException("either accessToken or authorizationCode is required");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", config.clientId());
        form.add("code", command.authorizationCode());
        String redirectUri = command.redirectUri() != null && !command.redirectUri().isBlank()
                ? command.redirectUri()
                : config.redirectUri();
        if (redirectUri != null && !redirectUri.isBlank()) {
            form.add("redirect_uri", redirectUri);
        }
        if (config.clientSecret() != null && !config.clientSecret().isBlank()) {
            form.add("client_secret", config.clientSecret());
        }
        if (command.hasCodeVerifier()) {
            form.add("code_verifier", command.codeVerifier());
        }

        JsonNode body;
        try {
            body = restClient
                    .post()
                    .uri(config.tokenUri())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            throw new OAuthAuthenticationException("token exchange failed for " + provider(), e);
        }
        if (body == null || !body.hasNonNull("access_token")) {
            throw new OAuthAuthenticationException("token exchange response has no access_token for " + provider());
        }
        return body.get("access_token").asText();
    }
}
