package com.yarmirror.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.yarmirror.backend.config.OAuthProperties;
import com.yarmirror.backend.domain.AuthProvider;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** Guards the PKCE contract: the verifier the mobile client generates must reach the provider. */
class OAuthTokenExchangeTest {

    private static final OAuthProperties PROPERTIES = new OAuthProperties(
            new OAuthProperties.Provider(
                    "kakao-id", "kakao-secret", "app://kakao", "https://kauth/token", "https://kapi/me"),
            new OAuthProperties.Provider(
                    "google-id", "google-secret", "app://google", "https://oauth2/token", "https://openid/me"));

    @Test
    void googleCodeExchangeForwardsPkceCodeVerifierAndReturnsTheMappedUser() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://oauth2/token"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentType(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().formDataContains(java.util.Map.of(
                        "grant_type", "authorization_code",
                        "code", "auth-code-from-expo",
                        "code_verifier", "pkce-verifier-from-expo",
                        "redirect_uri", "app://google",
                        "client_id", "google-id")))
                .andRespond(withSuccess("{\"access_token\":\"google-access-token\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://openid/me"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer google-access-token"))
                .andRespond(withSuccess(
                        "{\"sub\":\"104233\",\"name\":\"Mirror Kim\"}", MediaType.APPLICATION_JSON));

        GoogleOAuthProviderAdapter adapter = new GoogleOAuthProviderAdapter(builder.build(), PROPERTIES);
        OAuthUserInfo info = adapter.fetchUserInfo(
                new OAuthLoginCommand("auth-code-from-expo", null, null, "pkce-verifier-from-expo"));

        assertThat(info.provider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(info.providerId()).isEqualTo("104233");
        assertThat(info.nickname()).isEqualTo("Mirror Kim");
        server.verify();
    }

    @Test
    void kakaoCodeExchangeOmitsCodeVerifierWhenTheClientDidNotUsePkce() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://kauth/token"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(
                        "code_verifier"))))
                .andRespond(withSuccess("{\"access_token\":\"kakao-access-token\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://kapi/me"))
                .andExpect(header("Authorization", "Bearer kakao-access-token"))
                .andRespond(withSuccess("{\"id\":1234567890}", MediaType.APPLICATION_JSON));

        KakaoOAuthProviderAdapter adapter = new KakaoOAuthProviderAdapter(builder.build(), PROPERTIES);
        OAuthUserInfo info = adapter.fetchUserInfo(new OAuthLoginCommand("kakao-code", null, null, null));

        assertThat(info.providerId()).isEqualTo("1234567890");
        server.verify();
    }

    @Test
    void anAccessTokenFromTheClientSkipsTheTokenExchangeEntirely() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://kapi/me"))
                .andExpect(header("Authorization", "Bearer client-supplied-token"))
                .andRespond(withSuccess("{\"id\":42}", MediaType.APPLICATION_JSON));

        KakaoOAuthProviderAdapter adapter = new KakaoOAuthProviderAdapter(builder.build(), PROPERTIES);
        OAuthUserInfo info =
                adapter.fetchUserInfo(new OAuthLoginCommand(null, "client-supplied-token", null, null));

        assertThat(info.providerId()).isEqualTo("42");
        server.verify();
    }
}
