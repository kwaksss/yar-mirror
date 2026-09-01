package com.yarmirror.backend;

import static org.assertj.core.api.Assertions.assertThat;

import com.yarmirror.backend.auth.AuthController;
import com.yarmirror.backend.auth.JwtService;
import com.yarmirror.backend.auth.OAuthProviderRegistry;
import com.yarmirror.backend.config.JwtProperties;
import com.yarmirror.backend.config.OAuthProperties;
import com.yarmirror.backend.config.SpotProperties;
import com.yarmirror.backend.domain.AuthProvider;
import com.yarmirror.backend.repository.RefreshTokenRepository;
import com.yarmirror.backend.repository.SpotRepository;
import com.yarmirror.backend.repository.UserRepository;
import com.yarmirror.backend.spot.SpotController;
import com.yarmirror.backend.spot.storage.ObjectStoragePort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Boots the application without any datastore autoconfiguration so wiring, property binding and the
 * security chain are verified on a machine with no PostgreSQL available.
 */
@SpringBootTest(
        properties = {
            "spring.autoconfigure.exclude="
                    + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
                    + "org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration,"
                    + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
                    + "org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration,"
                    + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration"
        })
class ApplicationWiringTest {

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private RefreshTokenRepository refreshTokenRepository;

    @MockitoBean
    private SpotRepository spotRepository;

    @Autowired
    private JwtProperties jwtProperties;

    @Autowired
    private OAuthProperties oAuthProperties;

    @Autowired
    private SpotProperties spotProperties;

    @Autowired
    private OAuthProviderRegistry providerRegistry;

    @Autowired
    private ObjectStoragePort objectStorage;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AuthController authController;

    @Autowired
    private SpotController spotController;

    @Autowired
    private SecurityFilterChain securityFilterChain;

    @Test
    void bindsExternalizedConfigurationAndRegistersBothOAuthProviders() {
        assertThat(jwtProperties.secret()).isNotBlank();
        assertThat(jwtProperties.accessTokenTtlSeconds()).isEqualTo(1800);
        assertThat(jwtProperties.refreshTokenTtlSeconds()).isEqualTo(1209600);

        assertThat(oAuthProperties.kakao().userInfoUri()).isEqualTo("https://kapi.kakao.com/v2/user/me");
        assertThat(oAuthProperties.google().userInfoUri()).isEqualTo("https://www.googleapis.com/oauth2/v3/userinfo");

        assertThat(spotProperties.defaultRadiusMeters()).isEqualTo(2000);
        assertThat(spotProperties.maxRadiusMeters()).isEqualTo(20000);

        assertThat(providerRegistry.get(AuthProvider.KAKAO).provider()).isEqualTo(AuthProvider.KAKAO);
        assertThat(providerRegistry.get(AuthProvider.GOOGLE).provider()).isEqualTo(AuthProvider.GOOGLE);
    }

    @Test
    void wiresControllersSecurityChainAndStorageAdapter() {
        assertThat(authController).isNotNull();
        assertThat(spotController).isNotNull();
        assertThat(securityFilterChain).isNotNull();
        assertThat(objectStorage).isNotNull();
        assertThat(jwtService.issueAccessToken(1L, "미러러")).isNotBlank();
    }
}
