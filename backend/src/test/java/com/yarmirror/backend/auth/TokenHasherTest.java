package com.yarmirror.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TokenHasherTest {

    @Test
    void producesStableSha256HexNeverEqualToPlaintext() {
        String raw = "refresh-token-value";

        String hash = TokenHasher.sha256Hex(raw);

        assertThat(hash).hasSize(64).isNotEqualTo(raw).isEqualTo(TokenHasher.sha256Hex(raw));
    }

    @Test
    void differentTokensHashDifferently() {
        assertThat(TokenHasher.sha256Hex("a")).isNotEqualTo(TokenHasher.sha256Hex("b"));
    }

    @Test
    void rejectsBlankInput() {
        assertThatThrownBy(() -> TokenHasher.sha256Hex(" ")).isInstanceOf(IllegalArgumentException.class);
    }
}
