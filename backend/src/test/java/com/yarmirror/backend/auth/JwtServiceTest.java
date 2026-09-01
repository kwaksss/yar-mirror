package com.yarmirror.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.yarmirror.backend.config.JwtProperties;
import io.jsonwebtoken.Claims;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "test-secret-key-that-is-long-enough-for-hs256!!";
    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");
    private static final long ACCESS_TTL = 1800;
    private static final long REFRESH_TTL = 1209600;

    private JwtService serviceAt(Instant instant) {
        JwtProperties properties = new JwtProperties(SECRET, "yar-mirror", ACCESS_TTL, REFRESH_TTL);
        return new JwtService(properties, Clock.fixed(instant, ZoneOffset.UTC));
    }

    @Test
    void issuesAccessTokenCarryingUserIdAndNickname() {
        JwtService service = serviceAt(NOW);

        String token = service.issueAccessToken(42L, "미러러");
        Claims claims = service.parse(token, TokenType.ACCESS);

        assertThat(claims.getSubject()).isEqualTo("42");
        assertThat(claims.get(JwtService.CLAIM_NICKNAME, String.class)).isEqualTo("미러러");
        assertThat(claims.getIssuer()).isEqualTo("yar-mirror");
        assertThat(claims.getExpiration().toInstant()).isEqualTo(NOW.plusSeconds(ACCESS_TTL));
        assertThat(service.extractUserId(token, TokenType.ACCESS)).isEqualTo(42L);
    }

    @Test
    void rejectsAccessTokenAfterExpiry() {
        String token = serviceAt(NOW).issueAccessToken(42L, "미러러");
        JwtService later = serviceAt(NOW.plusSeconds(ACCESS_TTL).plus(Duration.ofMinutes(1)));

        assertThatThrownBy(() -> later.parse(token, TokenType.ACCESS))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void acceptsAccessTokenJustBeforeExpiry() {
        String token = serviceAt(NOW).issueAccessToken(42L, "미러러");
        JwtService later = serviceAt(NOW.plusSeconds(ACCESS_TTL - 1));

        assertThat(later.extractUserId(token, TokenType.ACCESS)).isEqualTo(42L);
    }

    @Test
    void refreshTokenOutlivesAccessTokenAndReportsItsExpiry() {
        JwtService service = serviceAt(NOW);

        String refreshToken = service.issueRefreshToken(7L);
        Claims claims = service.parse(refreshToken, TokenType.REFRESH);

        assertThat(claims.getExpiration().toInstant()).isEqualTo(NOW.plusSeconds(REFRESH_TTL));
        assertThat(service.refreshTokenExpiresAt()).isEqualTo(NOW.plusSeconds(REFRESH_TTL));
    }

    @Test
    void refusesToUseRefreshTokenAsAccessToken() {
        JwtService service = serviceAt(NOW);
        String refreshToken = service.issueRefreshToken(7L);

        assertThatThrownBy(() -> service.parse(refreshToken, TokenType.ACCESS))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessageContaining("expected ACCESS");
    }

    @Test
    void rejectsTokenSignedWithAnotherSecret() {
        JwtProperties foreign = new JwtProperties(
                "a-completely-different-secret-key-long-enough!!", "yar-mirror", ACCESS_TTL, REFRESH_TTL);
        String foreignToken = new JwtService(foreign, Clock.fixed(NOW, ZoneOffset.UTC)).issueAccessToken(1L, "x");

        assertThatThrownBy(() -> serviceAt(NOW).parse(foreignToken, TokenType.ACCESS))
                .isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void rejectsTamperedAndBlankTokens() {
        JwtService service = serviceAt(NOW);
        String token = service.issueAccessToken(42L, "미러러");
        String tampered = token.substring(0, token.length() - 2) + "xy";

        assertThatThrownBy(() -> service.parse(tampered, TokenType.ACCESS)).isInstanceOf(InvalidTokenException.class);
        assertThatThrownBy(() -> service.parse("  ", TokenType.ACCESS)).isInstanceOf(InvalidTokenException.class);
        assertThatThrownBy(() -> service.parse("not-a-jwt", TokenType.ACCESS)).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void rejectsSecretShorterThanHs256Requirement() {
        JwtProperties weak = new JwtProperties("too-short", "yar-mirror", ACCESS_TTL, REFRESH_TTL);

        assertThatThrownBy(() -> new JwtService(weak, Clock.fixed(NOW, ZoneOffset.UTC)))
                .isInstanceOf(IllegalStateException.class);
    }
}
