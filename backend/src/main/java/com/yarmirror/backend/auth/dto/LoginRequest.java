package com.yarmirror.backend.auth.dto;

import com.yarmirror.backend.auth.OAuthLoginCommand;

public record LoginRequest(String authorizationCode, String accessToken, String redirectUri, String codeVerifier) {

    public OAuthLoginCommand toCommand() {
        return new OAuthLoginCommand(authorizationCode, accessToken, redirectUri, codeVerifier);
    }
}
