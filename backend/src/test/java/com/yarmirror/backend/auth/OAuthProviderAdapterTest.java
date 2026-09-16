package com.yarmirror.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yarmirror.backend.config.OAuthProperties;
import com.yarmirror.backend.domain.AuthProvider;
import org.junit.jupiter.api.DisplayName;
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
    @DisplayName("각 어댑터가 올바른 provider(KAKAO/GOOGLE)를 보고한다")
    void kakaoAdapterIsRegisteredForKakaoAndGoogleForGoogle() {
        assertThat(kakao.provider()).isEqualTo(AuthProvider.KAKAO);
        assertThat(google.provider()).isEqualTo(AuthProvider.GOOGLE);
    }

    @Test
    @DisplayName("카카오: 숫자 id와 kakao_account.profile.nickname을 올바르게 매핑한다")
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
    @DisplayName("카카오: profile.nickname이 없으면 legacy properties.nickname으로, 그마저 없으면 생성된 닉네임으로 대체한다")
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
    @DisplayName("카카오: 닉네임이 컬럼 길이 제한(50자)을 넘으면 잘라낸다")
    void kakaoTruncatesNicknameLongerThanTheColumnLimit() {
        String longNickname = "가".repeat(60);

        OAuthUserInfo info = kakao.parseUserInfo(json(
                "{\"id\": 1, \"kakao_account\": {\"profile\": {\"nickname\": \"" + longNickname + "\"}}}"));

        assertThat(info.nickname()).hasSize(50).isEqualTo("가".repeat(50));
    }

    @Test
    @DisplayName("카카오: legacy properties.nickname도 컬럼 길이 제한(50자)을 넘으면 잘라낸다")
    void kakaoTruncatesLegacyPropertiesNicknameLongerThanTheColumnLimit() {
        OAuthUserInfo info = kakao.parseUserInfo(json(
                "{\"id\": 1, \"properties\": {\"nickname\": \"" + "n".repeat(64) + "\"}}"));

        assertThat(info.nickname()).hasSize(50);
    }

    @Test
    @DisplayName("카카오: 응답에 id가 없으면 OAuthAuthenticationException을 던진다")
    void kakaoRejectsResponseWithoutId() {
        assertThatThrownBy(() -> kakao.parseUserInfo(json("{\"kakao_account\": {}}")))
                .isInstanceOf(OAuthAuthenticationException.class);
    }

    @Test
    @DisplayName("구글: sub와 name을 올바르게 매핑한다")
    void googleMapsSubAndName() {
        OAuthUserInfo info = google.parseUserInfo(json("""
                {"sub": "104233", "name": "Mirror Kim", "email": "mirror@example.com"}
                """));

        assertThat(info.provider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(info.providerId()).isEqualTo("104233");
        assertThat(info.nickname()).isEqualTo("Mirror Kim");
    }

    @Test
    @DisplayName("구글: name이 없으면 email의 local part(@ 앞부분)로 대체한다")
    void googleFallsBackToEmailLocalPart() {
        OAuthUserInfo info = google.parseUserInfo(json("""
                {"sub": "104233", "email": "mirror@example.com"}
                """));

        assertThat(info.nickname()).isEqualTo("mirror");
    }

    @Test
    @DisplayName("구글: 닉네임이 컬럼 길이 제한(50자)을 넘으면 잘라낸다")
    void googleTruncatesNicknameLongerThanTheColumnLimit() {
        OAuthUserInfo info = google.parseUserInfo(json(
                "{\"sub\": \"104233\", \"name\": \"" + "M".repeat(60) + "\"}"));

        assertThat(info.nickname()).hasSize(50);
    }

    @Test
    @DisplayName("구글: 응답에 sub가 없으면 OAuthAuthenticationException을 던진다")
    void googleRejectsResponseWithoutSub() {
        assertThatThrownBy(() -> google.parseUserInfo(json("{\"name\": \"nobody\"}")))
                .isInstanceOf(OAuthAuthenticationException.class);
    }

    @Test
    @DisplayName("레지스트리: 두 어댑터를 provider로 조회할 수 있고, 알 수 없는 provider 이름은 거부한다")
    void providerRegistryResolvesBothAdaptersAndRejectsUnknownProviderNames() {
        OAuthProviderRegistry registry = new OAuthProviderRegistry(java.util.List.of(kakao, google));

        assertThat(registry.get(AuthProvider.KAKAO)).isSameAs(kakao);
        assertThat(registry.get(AuthProvider.GOOGLE)).isSameAs(google);
        assertThat(AuthProvider.from("kakao")).isEqualTo(AuthProvider.KAKAO);
        assertThat(AuthProvider.from("GOOGLE")).isEqualTo(AuthProvider.GOOGLE);
        assertThatThrownBy(() -> AuthProvider.from("naver")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("authorizationCode와 accessToken이 둘 다 없으면 네트워크 호출 전에 예외를 던진다")
    void loginCommandWithoutCredentialsFailsBeforeAnyNetworkCall() {
        assertThatThrownBy(() -> kakao.fetchUserInfo(new OAuthLoginCommand(null, null, null, null)))
                .isInstanceOf(OAuthAuthenticationException.class)
                .hasMessageContaining("accessToken or authorizationCode");
    }
}
