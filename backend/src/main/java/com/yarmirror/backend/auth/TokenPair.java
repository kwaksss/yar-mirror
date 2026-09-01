package com.yarmirror.backend.auth;

public record TokenPair(String accessToken, String refreshToken, long expiresInSeconds, String tokenType) {

    public static TokenPair bearer(String accessToken, String refreshToken, long expiresInSeconds) {
        return new TokenPair(accessToken, refreshToken, expiresInSeconds, "Bearer");
    }
}
