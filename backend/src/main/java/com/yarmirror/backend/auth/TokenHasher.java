package com.yarmirror.backend.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Refresh tokens are persisted only as a SHA-256 hex digest, never in plaintext. */
public final class TokenHasher {

    private TokenHasher() {
    }

    public static String sha256Hex(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("token must not be blank");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
