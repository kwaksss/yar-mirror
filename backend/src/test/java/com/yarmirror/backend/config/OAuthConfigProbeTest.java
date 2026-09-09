package com.yarmirror.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class OAuthConfigProbeTest {

    @Test
    @DisplayName("describeId는 blank가 아닌 값이 주어지면 원문 노출 없이 길이와 sha6 6자리를 반환한다")
    void describeId_returnsLengthAndSha6WithoutLeakingValue_whenValueIsPresent() {
        String value = "kakao-rest-api-key-EXAMPLE-abcXYZ";

        String described = OAuthConfigProbe.describeId(value);

        assertThat(described).doesNotContain(value);
        assertThat(described).startsWith("present len=" + value.length() + " sha6=");

        String sha6 = described.substring(described.lastIndexOf('=') + 1);
        assertThat(sha6).hasSize(6).matches("[0-9a-f]{6}");
    }

    @Test
    @DisplayName("describeId는 값이 null·빈 문자열·공백이면 sha6 없이 \"blank\"를 반환한다")
    void describeId_returnsBlankWithoutSha6_whenValueIsNullOrEmptyOrWhitespace() {
        for (String blank : new String[] {null, "", "   "}) {
            assertThat(OAuthConfigProbe.describeId(blank)).isEqualTo("blank");
        }
    }

    @Test
    @DisplayName("describeSecret는 blank가 아닌 값이 주어지면 sha6 없이 길이만 반환한다")
    void describeSecret_returnsLengthOnlyWithoutSha6_whenValueIsPresent() {
        String value = "super-secret-client-secret-value";

        String described = OAuthConfigProbe.describeSecret(value);

        assertThat(described).isEqualTo("present len=" + value.length());
        assertThat(described).doesNotContain(value).doesNotContain("sha6");
    }

    @Test
    @DisplayName("describeSecret는 값이 null·빈 문자열·공백이면 \"blank\"를 반환한다")
    void describeSecret_returnsBlank_whenValueIsNullOrEmptyOrWhitespace() {
        for (String blank : new String[] {null, "", "   "}) {
            assertThat(OAuthConfigProbe.describeSecret(blank)).isEqualTo("blank");
        }
    }
}
