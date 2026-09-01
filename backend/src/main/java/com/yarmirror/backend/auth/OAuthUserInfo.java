package com.yarmirror.backend.auth;

import com.yarmirror.backend.domain.AuthProvider;

public record OAuthUserInfo(AuthProvider provider, String providerId, String nickname) {

    public OAuthUserInfo {
        if (providerId == null || providerId.isBlank()) {
            throw new IllegalArgumentException("providerId must not be blank");
        }
        if (nickname == null || nickname.isBlank()) {
            nickname = defaultNickname(provider, providerId);
        }
    }

    private static String defaultNickname(AuthProvider provider, String providerId) {
        String suffix = providerId.length() <= 6 ? providerId : providerId.substring(providerId.length() - 6);
        return provider.name().charAt(0) + provider.name().substring(1).toLowerCase() + "_" + suffix;
    }
}
