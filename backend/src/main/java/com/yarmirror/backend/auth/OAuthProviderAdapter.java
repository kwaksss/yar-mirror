package com.yarmirror.backend.auth;

import com.yarmirror.backend.domain.AuthProvider;

public interface OAuthProviderAdapter {

    AuthProvider provider();

    OAuthUserInfo fetchUserInfo(OAuthLoginCommand command);
}
