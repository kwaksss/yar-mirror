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
import org.junit.jupiter.api.DisplayName;
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
    @DisplayName("로그인: 모바일 클라이언트가 보내는 authorizationCode + PKCE(codeVerifier) 요청 본문을 정상 처리한다")
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
    @DisplayName("로그인: authorizationCode 대신 provider accessToken으로도 로그인할 수 있다")
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
    @DisplayName("로그인: authorizationCode와 accessToken이 둘 다 없으면 400을 반환한다")
    void loginRejectsARequestWithNeitherACodeNorAnAccessTokenWithFourHundred() throws Exception {
        /** POST .auth/login/kakao
         *  Content-Type: application/json
         *  {}
         *  인증 코드와 액세스 토큰이 모두 없는 빈 JSON을 전송
         *
         *  예상 응답:
         *  {
         *      "code" : "BAD_REQUEST"
         *   }
         */
        mockMvc.perform(post("/auth/login/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    @DisplayName("로그인: authorizationCode와 accessToken을 동시에 보내면 400을 반환한다")
    void loginRejectsARequestCarryingBothACodeAndAnAccessTokenWithFourHundred() throws Exception {
        mockMvc.perform(post("/auth/login/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorizationCode\": \"code\", \"accessToken\": \"token\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    @DisplayName("로그인: DB 제약 조건 위반 시 값 노출 없이 409(DATA_CONSTRAINT)로 변환한다")
    void loginSurfacesADataConstraintViolationAsFourOhNineWithoutLeakingValues() throws Exception {
        when(authService.login(eq(AuthProvider.KAKAO), any()))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException(
                        "value too long for column nickname: 'super-secret-value'"));

        mockMvc.perform(post("/auth/login/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accessToken\": \"kakao-sdk-token\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DATA_CONSTRAINT"))
                .andExpect(jsonPath("$.message").value("data constraint violated"));
    }

    @Test
    @DisplayName("로그인: 지원하지 않는 provider로 요청하면 400을 반환한다")
    void loginRejectsAnUnknownProviderWithFourHundred() throws Exception {
        mockMvc.perform(post("/auth/login/naver")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorizationCode\": \"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    @DisplayName("리프레시: 정상 토큰은 새 토큰 쌍으로 회전시키고, 폐기된(revoked) 토큰은 거부한다")
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
    @DisplayName("리프레시: refreshToken이 빈 문자열이면 400(VALIDATION_FAILED)을 반환한다")
    void refreshRejectsABlankTokenWithFourHundred() throws Exception {
        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\": \"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("내 정보 조회: 인증이 없으면 401을 반환하고, 인증되면 id/닉네임/provider를 반환한다")
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
    @DisplayName("내 정보 조회: 인증된 사용자의 DB row가 삭제되어 없으면 404를 반환한다")
    void meReturnsFourOhFourWhenTheUserRowIsGone() throws Exception {
        when(authService.getUser(7L)).thenThrow(new NotFoundException("user not found: 7"));

        mockMvc.perform(get("/auth/me").with(authentication(new UsernamePasswordAuthenticationToken(
                        new AuthenticatedUser(7L, "미러러"), null, List.of()))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
