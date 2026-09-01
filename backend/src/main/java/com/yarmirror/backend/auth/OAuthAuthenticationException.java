package com.yarmirror.backend.auth;

public class OAuthAuthenticationException extends RuntimeException {

    public OAuthAuthenticationException(String message) {
        super(message);
    }

    public OAuthAuthenticationException(String message, Throwable cause) {
        super(message, cause);
    }
}
