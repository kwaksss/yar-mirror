package com.yarmirror.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.oauth")
public record OAuthProperties(Provider kakao, Provider google) {

    public record Provider(
            String clientId, String clientSecret, String redirectUri, String tokenUri, String userInfoUri) {
    }
}
