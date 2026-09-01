package com.yarmirror.backend.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.yarmirror.backend.common.NotFoundException;
import com.yarmirror.backend.config.SecurityConfig;
import com.yarmirror.backend.domain.AuthProvider;
import com.yarmirror.backend.domain.User;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Pins the JSON the mobile client actually sends and receives on /auth. The field names here are the
 * contract — changing them breaks the app even though every unit test would stay green.
 */
@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class AuthControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtService jwtService;

    private static User userWithId(long id, String nickname, AuthProvider provider) {
        User user = User.of(nickname, provider, "provider-1");
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    @Test
    void loginAcceptsTheAuthorizationCodePkceBodyTheMobileClientSends() throws Exception {
        when(authService.login(eq(AuthProvider.GOOGLE), any()))
                .thenReturn(TokenPair.bearer("access-jwt", "refresh-jwt", 1800));

        mockMvc.perform(post("/auth/login/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {
                                  "authorizationCode": "auth-code-from-expo",
                                  "redirectUri": "yarmirror://redirect",
                                  "codeVerifier": "pkce-verifier-from-expo"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-jwt"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-jwt"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(1800));

        ArgumentCaptor<OAuthLoginCommand> captor = ArgumentCaptor.forClass(OAuthLoginCommand.class);
        verify(authService).login(eq(AuthProvider.GOOGLE), captor.capture());
        OAuthLoginCommand command = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(command.authorizationCode()).isEqualTo("auth-code-from-expo");
        org.assertj.core.api.Assertions.assertThat(command.codeVerifier()).isEqualTo("pkce-verifier-from-expo");
        org.assertj.core.api.Assertions.assertThat(command.redirectUri()).isEqualTo("yarmirror://redirect");
    }

    @Test
    void loginAlsoAcceptsAProviderAccessTokenInsteadOfACode() throws Exception {
        when(authService.login(eq(AuthProvider.KAKAO), any()))
                .thenReturn(TokenPair.bearer("access-jwt", "refresh-jwt", 1800));

        mockMvc.perform(post("/auth/login/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accessToken\": \"kakao-sdk-token\"}"))
                .andExpect(status().isOk());

        ArgumentCaptor<OAuthLoginCommand> captor = ArgumentCaptor.forClass(OAuthLoginCommand.class);
        verify(authService).login(eq(AuthProvider.KAKAO), captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().accessToken()).isEqualTo("kakao-sdk-token");
    }

    @Test
    void loginRejectsAnUnknownProviderWithFourHundred() throws Exception {
        mockMvc.perform(post("/auth/login/naver")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorizationCode\": \"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void refreshReturnsARotatedPairAndRejectsARevokedToken() throws Exception {
        when(authService.refresh("good-refresh")).thenReturn(TokenPair.bearer("new-access", "new-refresh", 1800));
        when(authService.refresh("revoked-refresh"))
                .thenThrow(new InvalidTokenException("refresh token has been revoked"));

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\": \"good-refresh\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-access"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh"));

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\": \"revoked-refresh\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    void refreshRejectsABlankTokenWithFourHundred() throws Exception {
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\": \"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void meRequiresAuthenticationAndReturnsTheNickname() throws Exception {
        mockMvc.perform(get("/auth/me")).andExpect(status().isUnauthorized());

        when(authService.getUser(7L)).thenReturn(userWithId(7L, "미러러", AuthProvider.KAKAO));

        mockMvc.perform(get("/auth/me").with(authentication(new UsernamePasswordAuthenticationToken(
                        new AuthenticatedUser(7L, "미러러"), null, List.of()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.nickname").value("미러러"))
                .andExpect(jsonPath("$.provider").value("KAKAO"));
    }

    @Test
    void meReturnsFourOhFourWhenTheUserRowIsGone() throws Exception {
        when(authService.getUser(7L)).thenThrow(new NotFoundException("user not found: 7"));

        mockMvc.perform(get("/auth/me").with(authentication(new UsernamePasswordAuthenticationToken(
                        new AuthenticatedUser(7L, "미러러"), null, List.of()))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
