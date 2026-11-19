package com.yarmirror.backend.auth.dto;

import com.yarmirror.backend.auth.OAuthLoginCommand;
/**
 * 클라이언트가 /auth/login/{provider} 로그인 API로 보내는 요청 데이터를 받고,
 * 유효성 검사한 뒤 서비스 계층에서 사용할 OAuthLoginCommand로 변환하는 DTO
 **/
public record LoginRequest(
        String authorizationCode,           // OAuth Provider에서 발급받은 인가 코드
        String accessToken,
        String redirectUri,
        String codeVerifier) {

    /// authorizationCode와 accessToken은 둘중 하나만 있어야한다. -> 로그인 방법이 확실해야하기 때문.
    public OAuthLoginCommand toCommand() {
        boolean hasCode = authorizationCode != null && !authorizationCode.isBlank();
        boolean hasAccessToken = accessToken != null && !accessToken.isBlank();
        if (hasCode == hasAccessToken) {
            throw new IllegalArgumentException("exactly one of authorizationCode / accessToken is required");
        }
        return new OAuthLoginCommand(authorizationCode, accessToken, redirectUri, codeVerifier);
    }
}
