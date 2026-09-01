package com.yarmirror.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yarmirror.backend.config.JwtProperties;
import com.yarmirror.backend.domain.AuthProvider;
import com.yarmirror.backend.domain.RefreshToken;
import com.yarmirror.backend.domain.User;
import com.yarmirror.backend.repository.RefreshTokenRepository;
import com.yarmirror.backend.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");

    @Mock
    private OAuthProviderRegistry providerRegistry;

    @Mock
    private OAuthProviderAdapter kakaoAdapter;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        jwtService = new JwtService(
                new JwtProperties("test-secret-key-that-is-long-enough-for-hs256!!", "yar-mirror", 1800, 1209600),
                clock);
        authService = new AuthService(providerRegistry, userRepository, refreshTokenRepository, jwtService, clock);
    }

    private static User userWithId(long id, String nickname, AuthProvider provider, String providerId) {
        User user = User.of(nickname, provider, providerId);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    @Test
    void loginCreatesUserOnFirstVisitAndStoresOnlyTheRefreshTokenHash() {
        OAuthLoginCommand command = new OAuthLoginCommand(null, "provider-access-token", null, null);
        when(providerRegistry.get(AuthProvider.KAKAO)).thenReturn(kakaoAdapter);
        when(kakaoAdapter.fetchUserInfo(command))
                .thenReturn(new OAuthUserInfo(AuthProvider.KAKAO, "kakao-1", "미러러"));
        when(userRepository.findByProviderAndProviderId(AuthProvider.KAKAO, "kakao-1"))
                .thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 100L);
            return saved;
        });

        TokenPair tokens = authService.login(AuthProvider.KAKAO, command);

        assertThat(jwtService.extractUserId(tokens.accessToken(), TokenType.ACCESS)).isEqualTo(100L);
        assertThat(jwtService.extractUserId(tokens.refreshToken(), TokenType.REFRESH)).isEqualTo(100L);
        assertThat(tokens.tokenType()).isEqualTo("Bearer");
        assertThat(tokens.expiresInSeconds()).isEqualTo(1800);

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        RefreshToken stored = captor.getValue();
        assertThat(stored.getTokenHash())
                .isNotEqualTo(tokens.refreshToken())
                .isEqualTo(TokenHasher.sha256Hex(tokens.refreshToken()));
        assertThat(stored.getExpiresAt()).isEqualTo(NOW.plusSeconds(1209600));
    }

    @Test
    void loginReusesExistingUserForKnownProviderIdentity() {
        OAuthLoginCommand command = new OAuthLoginCommand("code", null, null, "pkce-verifier");
        User existing = userWithId(5L, "기존유저", AuthProvider.KAKAO, "kakao-1");
        when(providerRegistry.get(AuthProvider.KAKAO)).thenReturn(kakaoAdapter);
        when(kakaoAdapter.fetchUserInfo(command))
                .thenReturn(new OAuthUserInfo(AuthProvider.KAKAO, "kakao-1", "새닉네임"));
        when(userRepository.findByProviderAndProviderId(AuthProvider.KAKAO, "kakao-1"))
                .thenReturn(Optional.of(existing));

        TokenPair tokens = authService.login(AuthProvider.KAKAO, command);

        verify(userRepository, never()).save(any(User.class));
        assertThat(jwtService.extractUserId(tokens.accessToken(), TokenType.ACCESS)).isEqualTo(5L);
    }

    @Test
    void refreshRotatesTokensForAUsableRefreshToken() {
        User user = userWithId(5L, "미러러", AuthProvider.GOOGLE, "google-1");
        String rawRefresh = jwtService.issueRefreshToken(5L);
        RefreshToken stored =
                RefreshToken.issue(5L, TokenHasher.sha256Hex(rawRefresh), NOW.plusSeconds(1209600));
        when(refreshTokenRepository.findByTokenHash(TokenHasher.sha256Hex(rawRefresh)))
                .thenReturn(Optional.of(stored));
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));

        TokenPair rotated = authService.refresh(rawRefresh);

        assertThat(jwtService.extractUserId(rotated.accessToken(), TokenType.ACCESS)).isEqualTo(5L);
        assertThat(stored.isRevoked()).isTrue();
        assertThat(stored.getRevokedAt()).isEqualTo(NOW);
    }

    @Test
    void refreshRejectsRevokedToken() {
        String rawRefresh = jwtService.issueRefreshToken(5L);
        RefreshToken stored =
                RefreshToken.issue(5L, TokenHasher.sha256Hex(rawRefresh), NOW.plusSeconds(1209600));
        stored.revoke(NOW.minusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(TokenHasher.sha256Hex(rawRefresh)))
                .thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> authService.refresh(rawRefresh))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessageContaining("revoked");
        verify(userRepository, never()).findById(any());
    }

    @Test
    void refreshRejectsTokenExpiredInStorage() {
        String rawRefresh = jwtService.issueRefreshToken(5L);
        RefreshToken stored = RefreshToken.issue(5L, TokenHasher.sha256Hex(rawRefresh), NOW.minusSeconds(1));
        when(refreshTokenRepository.findByTokenHash(TokenHasher.sha256Hex(rawRefresh)))
                .thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> authService.refresh(rawRefresh))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void refreshRejectsUnknownToken() {
        String rawRefresh = jwtService.issueRefreshToken(5L);
        when(refreshTokenRepository.findByTokenHash(TokenHasher.sha256Hex(rawRefresh)))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.refresh(rawRefresh)).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void refreshRejectsAnAccessTokenPresentedAsRefreshToken() {
        String accessToken = jwtService.issueAccessToken(5L, "미러러");

        assertThatThrownBy(() -> authService.refresh(accessToken)).isInstanceOf(InvalidTokenException.class);
        verify(refreshTokenRepository, never()).findByTokenHash(any());
    }
}
