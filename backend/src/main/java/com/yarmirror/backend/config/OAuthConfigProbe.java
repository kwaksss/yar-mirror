package com.yarmirror.backend.config;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 애플리케이션 시작시 Kakao/Google OAuth 설정값이 제대로 주입됐는지 안전하게 확인하는 진단용 코드.

 .env -> application.yml -> OAuthProperties -> OAuthConfigProbe
 OAuthProperties 객체에 실제로 값이 들왔는지 확인.
 */
@Component
@Profile("local")
public class OAuthConfigProbe implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OAuthConfigProbe.class);

    private final OAuthProperties oAuthProperties;

    public OAuthConfigProbe(OAuthProperties oAuthProperties) {
        this.oAuthProperties = oAuthProperties;
    }

    /// ApplicationRunner를 구현하면 Spring Boot가 애플리케이션 시작과정에서 Bean 구성 마치고 run()을 호출.
    @Override
    public void run(ApplicationArguments args) {
        log.info(
                "OAuth cfg: kakao.clientId {} · kakao.clientSecret {} · google.clientId {} · google.clientSecret {}",
                describeId(oAuthProperties.kakao().clientId()),
                describeSecret(oAuthProperties.kakao().clientSecret()),
                describeId(oAuthProperties.google().clientId()),
                describeSecret(oAuthProperties.google().clientSecret()));
    }

    /// describedId()와 describeSecret()을 거쳐 실제 값 대신 안전한 정보만 출력.
    /// len: 길이
    /// SHA-256 해시 앞 6자리만.
    static String describeId(String value) {
        if (value == null || value.isBlank()) {
            return "blank";
        }
        return "present len=" + value.length() + " sha6=" + sha256Hex(value).substring(0, 6);
    }

    static String describeSecret(String value) {
        if (value == null || value.isBlank()) {
            return "blank";
        }
        return "present len=" + value.length();
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
