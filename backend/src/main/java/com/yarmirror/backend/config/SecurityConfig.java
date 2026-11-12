package com.yarmirror.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yarmirror.backend.auth.JwtAuthenticationFilter;
import com.yarmirror.backend.common.ErrorResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            ObjectMapper objectMapper,
            CorsConfigurationSource corsConfigurationSource,
            @Value("${app.storage.type:local}") String storageType)
            throws Exception {
        String[] publicPaths = publicPaths(storageType);
        return http.csrf(csrf -> csrf.disable())
                // 인증 필터보다 먼저 CORS를 처리해야 preflight(OPTIONS)와 401 응답에도 CORS 헤더가 붙는다.
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.requestMatchers(publicPaths)
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .exceptionHandling(handling -> handling.authenticationEntryPoint(unauthorizedEntryPoint(objectMapper)))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * 인증 없이 열어 두는 경로.
     *
     * <ul>
     *   <li>{@code /error} — {@code sendError()}가 내부 포워드하는 경로다. 막아 두면 404/405/500이 전부 401로 가려진다.</li>
     *   <li>{@code /local-storage/**} — 로컬 스토리지({@code app.storage.type=local})에서만 연다. presigned PUT과
     *       공개 읽기를 흉내 내는 개발용 엔드포인트이며, {@code s3}에서는 클라이언트가 버킷에 직접 접근한다.</li>
     * </ul>
     */
    static String[] publicPaths(String storageType) {
        List<String> paths = new ArrayList<>(List.of("/auth/login/**", "/auth/refresh", "/error"));
        if ("local".equalsIgnoreCase(storageType)) {
            paths.add("/local-storage/**");
        }
        return paths.toArray(String[]::new);
    }

    /**
     * 웹(브라우저) 클라이언트가 다른 origin(예: Expo 웹 개발 서버 {@code http://localhost:8081})에서 API를 호출할 수
     * 있도록 CORS를 허용한다. 네이티브 앱은 CORS의 영향을 받지 않는다.
     *
     * <p>허용 origin은 {@code app.cors.allowed-origins}(쉼표 구분)로 지정하며, 목록에 없는 origin은 거부된다.
     * 인증은 쿠키가 아닌 {@code Authorization} 헤더의 JWT를 쓰므로 자격 증명(credentials) 허용은 켜지 않는다.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:http://localhost:8081}") String[] allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigins));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private AuthenticationEntryPoint unauthorizedEntryPoint(ObjectMapper objectMapper) {
        return (request, response, authException) -> {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(
                    response.getOutputStream(), new ErrorResponse("UNAUTHORIZED", "authentication is required"));
        };
    }
}
