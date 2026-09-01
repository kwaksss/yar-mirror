package com.yarmirror.backend.auth.dto;

import com.yarmirror.backend.auth.TokenPair;

public record TokenResponse(String accessToken, String refreshToken, String tokenType, long expiresIn) {

    public static TokenResponse from(TokenPair pair) {
        return new TokenResponse(pair.accessToken(), pair.refreshToken(), pair.tokenType(), pair.expiresInSeconds());
    }
}
