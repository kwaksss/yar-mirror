package com.yarmirror.backend.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.yarmirror.backend.config.OAuthProperties;
import com.yarmirror.backend.domain.AuthProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class GoogleOAuthProviderAdapter extends AbstractOAuthProviderAdapter {

    public GoogleOAuthProviderAdapter(RestClient restClient, OAuthProperties properties) {
        super(restClient, properties.google());
    }

    @Override
    public AuthProvider provider() {
        return AuthProvider.GOOGLE;
    }

    @Override
    protected OAuthUserInfo parseUserInfo(JsonNode body) {
        if (!body.hasNonNull("sub")) {
            throw new OAuthAuthenticationException("google user info has no sub");
        }
        return new OAuthUserInfo(AuthProvider.GOOGLE, body.get("sub").asText(), extractNickname(body));
    }

    private String extractNickname(JsonNode body) {
        JsonNode name = body.path("name");
        if (name.isTextual() && !name.asText().isBlank()) {
            return name.asText();
        }
        JsonNode email = body.path("email");
        if (email.isTextual() && email.asText().contains("@")) {
            return email.asText().substring(0, email.asText().indexOf('@'));
        }
        return null;
    }
}
