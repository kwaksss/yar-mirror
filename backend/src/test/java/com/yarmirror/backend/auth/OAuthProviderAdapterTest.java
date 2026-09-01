package com.yarmirror.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yarmirror.backend.config.OAuthProperties;
import com.yarmirror.backend.domain.AuthProvider;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class OAuthProviderAdapterTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final OAuthProperties PROPERTIES = new OAuthProperties(
            new OAuthProperties.Provider("kakao-id", "kakao-secret", "app://kakao", "http://token", "http://me"),
            new OAuthProperties.Provider("google-id", "google-secret", "app://google", "http://token", "http://me"));

    private final KakaoOAuthProviderAdapter kakao =
            new KakaoOAuthProviderAdapter(RestClient.builder().build(), PROPERTIES);
    private final GoogleOAuthProviderAdapter google =
            new GoogleOAuthProviderAdapter(RestClient.builder().build(), PROPERTIES);

    private static JsonNode json(String raw) {
        try {
            return MAPPER.readTree(raw);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void kakaoAdapterIsRegisteredForKakaoAndGoogleForGoogle() {
        assertThat(kakao.provider()).isEqualTo(AuthProvider.KAKAO);
        assertThat(google.provider()).isEqualTo(AuthProvider.GOOGLE);
    }

    @Test
    void kakaoMapsNumericIdAndProfileNickname() {
        JsonNode body = json(
                """
                {"id": 1234567890, "kakao_account": {"profile": {"nickname": "거울러"}}}
                """);

        OAuthUserInfo info = kakao.parseUserInfo(body);

        assertThat(info.provider()).isEqualTo(AuthProvider.KAKAO);
        assertThat(info.providerId()).isEqualTo("1234567890");
        assertThat(info.nickname()).isEqualTo("거울러");
    }

    @Test
    void kakaoFallsBackToLegacyPropertiesNicknameThenToGeneratedNickname() {
        OAuthUserInfo legacy = kakao.parseUserInfo(json("""
                {"id": 42, "properties": {"nickname": "옛닉"}}
                """));
        OAuthUserInfo generated = kakao.parseUserInfo(json("""
                {"id": 1234567890}
                """));

        assertThat(legacy.nickname()).isEqualTo("옛닉");
        assertThat(generated.nickname()).isEqualTo("Kakao_567890");
    }

    @Test
    void kakaoRejectsResponseWithoutId() {
        assertThatThrownBy(() -> kakao.parseUserInfo(json("{\"kakao_account\": {}}")))
                .isInstanceOf(OAuthAuthenticationException.class);
    }

    @Test
    void googleMapsSubAndName() {
        OAuthUserInfo info = google.parseUserInfo(json("""
                {"sub": "104233", "name": "Mirror Kim", "email": "mirror@example.com"}
                """));

        assertThat(info.provider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(info.providerId()).isEqualTo("104233");
        assertThat(info.nickname()).isEqualTo("Mirror Kim");
    }

    @Test
    void googleFallsBackToEmailLocalPart() {
        OAuthUserInfo info = google.parseUserInfo(json("""
                {"sub": "104233", "email": "mirror@example.com"}
                """));

        assertThat(info.nickname()).isEqualTo("mirror");
    }

    @Test
    void googleRejectsResponseWithoutSub() {
        assertThatThrownBy(() -> google.parseUserInfo(json("{\"name\": \"nobody\"}")))
                .isInstanceOf(OAuthAuthenticationException.class);
    }

    @Test
    void providerRegistryResolvesBothAdaptersAndRejectsUnknownProviderNames() {
        OAuthProviderRegistry registry = new OAuthProviderRegistry(java.util.List.of(kakao, google));

        assertThat(registry.get(AuthProvider.KAKAO)).isSameAs(kakao);
        assertThat(registry.get(AuthProvider.GOOGLE)).isSameAs(google);
        assertThat(AuthProvider.from("kakao")).isEqualTo(AuthProvider.KAKAO);
        assertThat(AuthProvider.from("GOOGLE")).isEqualTo(AuthProvider.GOOGLE);
        assertThatThrownBy(() -> AuthProvider.from("naver")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void loginCommandWithoutCredentialsFailsBeforeAnyNetworkCall() {
        assertThatThrownBy(() -> kakao.fetchUserInfo(new OAuthLoginCommand(null, null, null, null)))
                .isInstanceOf(OAuthAuthenticationException.class)
                .hasMessageContaining("accessToken or authorizationCode");
    }
}
