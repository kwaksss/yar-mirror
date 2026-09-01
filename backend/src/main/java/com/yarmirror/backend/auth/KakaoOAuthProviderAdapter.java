package com.yarmirror.backend.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.yarmirror.backend.config.OAuthProperties;
import com.yarmirror.backend.domain.AuthProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class KakaoOAuthProviderAdapter extends AbstractOAuthProviderAdapter {

    public KakaoOAuthProviderAdapter(RestClient restClient, OAuthProperties properties) {
        super(restClient, properties.kakao());
    }

    @Override
    public AuthProvider provider() {
        return AuthProvider.KAKAO;
    }

    @Override
    protected OAuthUserInfo parseUserInfo(JsonNode body) {
        if (!body.hasNonNull("id")) {
            throw new OAuthAuthenticationException("kakao user info has no id");
        }
        String providerId = body.get("id").asText();
        return new OAuthUserInfo(AuthProvider.KAKAO, providerId, extractNickname(body));
    }

    private String extractNickname(JsonNode body) {
        JsonNode profileNickname = body.path("kakao_account").path("profile").path("nickname");
        if (profileNickname.isTextual() && !profileNickname.asText().isBlank()) {
            return profileNickname.asText();
        }
        JsonNode legacyNickname = body.path("properties").path("nickname");
        return legacyNickname.isTextual() ? legacyNickname.asText() : null;
    }
}
