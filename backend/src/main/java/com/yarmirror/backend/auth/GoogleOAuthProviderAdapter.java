package com.yarmirror.backend.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.yarmirror.backend.config.OAuthProperties;
import com.yarmirror.backend.domain.AuthProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
/** Google OAuth에서 받은 사용자 정보를 우리 서비스 공통 사용자 정보 형태로 변환하는 Adapter*/
@Component
public class GoogleOAuthProviderAdapter extends AbstractOAuthProviderAdapter {

    public GoogleOAuthProviderAdapter(RestClient restClient, OAuthProperties properties) {
        super(restClient, properties.google());
    }

    // Adapter가 어떤 OAuth Provider를 담당하는지 알려준다.
    @Override
    public AuthProvider provider() {
        return AuthProvider.GOOGLE;
    }

    /// Google에서 JSON이 들어왔을때 {"sub" : "11111111", "name" : "곽인성", "email": "kis2690@naver.com"}
    @Override
    protected OAuthUserInfo parseUserInfo(JsonNode body) {
        // sub: Google OAuth에서 Google 사용자를 식별하는 고유 식별자.
        if (!body.hasNonNull("sub")) {
            throw new OAuthAuthenticationException("google 사용자 정보에 sub이 없습니다.");
        }
        return new OAuthUserInfo(AuthProvider.GOOGLE, body.get("sub").asText(), extractNickname(body));
    }

    /// Google 응답에서 닉네임으로 사용할 값 정한다. -> name사용, 없으면 email의 @앞부분. 없으면 null
    private String extractNickname(JsonNode body) {
        JsonNode name = body.path("name");
        if (name.isTextual() && !name.asText().isBlank()) {
            return truncateNickname(name.asText());
        }
        JsonNode email = body.path("email");
        if (email.isTextual() && email.asText().contains("@")) {
            return truncateNickname(email.asText().substring(0, email.asText().indexOf('@')));
        }
        return null;
    }
}
