package com.yarmirror.backend.auth;

import com.yarmirror.backend.common.NotFoundException;
import com.yarmirror.backend.domain.AuthProvider;
import com.yarmirror.backend.domain.RefreshToken;
import com.yarmirror.backend.domain.User;
import com.yarmirror.backend.repository.RefreshTokenRepository;
import com.yarmirror.backend.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final OAuthProviderRegistry providerRegistry;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final Clock clock;

    public AuthService(
            OAuthProviderRegistry providerRegistry,
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            JwtService jwtService,
            Clock clock) {
        this.providerRegistry = providerRegistry;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.clock = clock;
    }

    @Transactional
    public TokenPair login(AuthProvider provider, OAuthLoginCommand command) {
        OAuthUserInfo userInfo = providerRegistry.get(provider).fetchUserInfo(command);
        User user = userRepository
                .findByProviderAndProviderId(provider, userInfo.providerId())
                .orElseGet(() -> userRepository.save(User.of(userInfo.nickname(), provider, userInfo.providerId())));
        return issueTokens(user);
    }

    @Transactional
    public TokenPair refresh(String rawRefreshToken) {
        Long userId = jwtService.extractUserId(rawRefreshToken, TokenType.REFRESH);
        RefreshToken stored = refreshTokenRepository
                .findByTokenHash(TokenHasher.sha256Hex(rawRefreshToken))
                .orElseThrow(() -> new InvalidTokenException("refresh token is not recognized"));

        Instant now = clock.instant();
        if (stored.isRevoked()) {
            throw new InvalidTokenException("refresh token has been revoked");
        }
        if (stored.isExpiredAt(now)) {
            throw new InvalidTokenException("refresh token has expired");
        }
        if (!stored.getUserId().equals(userId)) {
            throw new InvalidTokenException("refresh token does not belong to its subject");
        }

        stored.revoke(now);
        refreshTokenRepository.save(stored);

        User user = userRepository
                .findById(userId)
                .orElseThrow(() -> new NotFoundException("user not found: " + userId));
        return issueTokens(user);
    }

    @Transactional(readOnly = true)
    public User getUser(Long userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new NotFoundException("user not found: " + userId));
    }

    private TokenPair issueTokens(User user) {
        String accessToken = jwtService.issueAccessToken(user.getId(), user.getNickname());
        String refreshToken = jwtService.issueRefreshToken(user.getId());
        refreshTokenRepository.save(RefreshToken.issue(
                user.getId(), TokenHasher.sha256Hex(refreshToken), jwtService.refreshTokenExpiresAt()));
        return TokenPair.bearer(accessToken, refreshToken, jwtService.accessTokenTtlSeconds());
    }
}
