package com.yarmirror.backend.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.yarmirror.backend.auth.AuthController;
import com.yarmirror.backend.auth.AuthService;
import com.yarmirror.backend.auth.JwtAuthenticationFilter;
import com.yarmirror.backend.auth.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 웹(브라우저) 클라이언트가 Expo 웹 개발 서버(http://localhost:8081)에서 API를 호출할 수 있도록 CORS가 설정되어 있는지 확인한다.
 * 허용 origin 기본값은 {@code application.yml}의 {@code app.cors.allowed-origins}와 동일하게 localhost:8081이다.
 */
@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class CorsConfigTest {

    private static final String ALLOWED_ORIGIN = "http://localhost:8081";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    @DisplayName("허용된 origin의 preflight(OPTIONS) 요청은 인증 없이 통과하고 CORS 헤더를 돌려준다")
    void allowsPreflightFromTheAllowedOriginWithoutAuthentication() throws Exception {
        // given: 브라우저가 로그인 POST 전에 보내는 preflight 요청
        // when & then
        mockMvc.perform(options("/auth/login/kakao")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type,authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN));
    }

    @Test
    @DisplayName("허용 목록에 없는 origin의 preflight 요청은 거부한다")
    void rejectsPreflightFromAnOriginThatIsNotAllowed() throws Exception {
        // given: 허용 목록에 없는 origin
        // when & then
        mockMvc.perform(options("/auth/login/kakao")
                        .header(HttpHeaders.ORIGIN, "http://evil.example.com")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("인증 실패(401) 응답에도 CORS 헤더가 붙어 브라우저가 상태 코드를 읽을 수 있다")
    void attachesCorsHeadersToUnauthorizedResponses() throws Exception {
        // given: 토큰 없이 보호된 API를 호출하면 401이지만, 브라우저는 CORS 헤더가 없으면 이 응답을 읽지 못한다
        // when & then
        mockMvc.perform(get("/auth/me").header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN));
    }
}
