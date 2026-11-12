package com.yarmirror.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SecurityConfigPublicPathsTest {

    @Test
    void localStorageIsPublicOnlyForTheLocalStorageType() {
        // when
        String[] local = SecurityConfig.publicPaths("local");
        String[] s3 = SecurityConfig.publicPaths("s3");

        // then
        assertThat(local).contains("/auth/login/**", "/auth/refresh", "/error", "/local-storage/**");
        assertThat(s3).contains("/auth/login/**", "/auth/refresh", "/error");
        assertThat(s3).doesNotContain("/local-storage/**");
    }
}
