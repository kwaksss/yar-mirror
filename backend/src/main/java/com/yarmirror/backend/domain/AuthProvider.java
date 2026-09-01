package com.yarmirror.backend.domain;

import java.util.Locale;

public enum AuthProvider {
    KAKAO,
    GOOGLE;

    public static AuthProvider from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("provider must not be blank");
        }
        try {
            return AuthProvider.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("unsupported provider: " + value);
        }
    }
}
