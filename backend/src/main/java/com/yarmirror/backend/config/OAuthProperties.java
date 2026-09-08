package com.yarmirror.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
/// application.yml에 있는 OAuth 설정을 자바 객체로 묶어주는 설정 전용 클래스.
/// OAuthProperties에 Provider형 객체 kakao, google이 들어온다.
/// Provider형 객체는 clientId, clientSecret, redirectUri, tokenUri, userInfoUri를 갖는다.

@ConfigurationProperties(prefix = "app.oauth")
public record OAuthProperties(Provider kakao, Provider google) {

    public record Provider(
            String clientId,
            String clientSecret,
            String redirectUri,
            String tokenUri,
            String userInfoUri) {

    }
}
