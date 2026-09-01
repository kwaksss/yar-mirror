package com.yarmirror.backend.auth;

import com.yarmirror.backend.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    static final String CLAIM_TOKEN_TYPE = "typ";
    static final String CLAIM_NICKNAME = "nickname";

    private final JwtProperties properties;
    private final Clock clock;
    private final SecretKey key;

    public JwtService(JwtProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
        byte[] secretBytes = properties.secret() == null
                ? new byte[0]
                : properties.secret().getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret must be at least 32 bytes for HS256");
        }
        this.key = Keys.hmacShaKeyFor(secretBytes);
    }

    public String issueAccessToken(Long userId, String nickname) {
        Instant now = clock.instant();
        return Jwts.builder()
                .issuer(properties.issuer())
                .subject(String.valueOf(userId))
                .id(UUID.randomUUID().toString())
                .claim(CLAIM_TOKEN_TYPE, TokenType.ACCESS.name())
                .claim(CLAIM_NICKNAME, nickname)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(properties.accessTokenTtlSeconds())))
                .signWith(key)
                .compact();
    }

    public String issueRefreshToken(Long userId) {
        Instant now = clock.instant();
        return Jwts.builder()
                .issuer(properties.issuer())
                .subject(String.valueOf(userId))
                .id(UUID.randomUUID().toString())
                .claim(CLAIM_TOKEN_TYPE, TokenType.REFRESH.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(properties.refreshTokenTtlSeconds())))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token, TokenType expectedType) {
        if (token == null || token.isBlank()) {
            throw new InvalidTokenException("token must not be blank");
        }
        Claims claims;
        try {
            claims = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(properties.issuer())
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException("invalid token: " + e.getMessage(), e);
        }
        String actualType = claims.get(CLAIM_TOKEN_TYPE, String.class);
        if (!expectedType.name().equals(actualType)) {
            throw new InvalidTokenException("expected " + expectedType + " token but got " + actualType);
        }
        return claims;
    }

    public Long extractUserId(String token, TokenType expectedType) {
        Claims claims = parse(token, expectedType);
        try {
            return Long.valueOf(claims.getSubject());
        } catch (NumberFormatException e) {
            throw new InvalidTokenException("token subject is not a user id", e);
        }
    }

    public Instant refreshTokenExpiresAt() {
        return clock.instant().plusSeconds(properties.refreshTokenTtlSeconds());
    }

    public long accessTokenTtlSeconds() {
        return properties.accessTokenTtlSeconds();
    }
}
