package com.yarmirror.backend.auth.dto;

import com.yarmirror.backend.domain.User;

public record MeResponse(Long id, String nickname, String provider) {

    public static MeResponse from(User user) {
        return new MeResponse(user.getId(), user.getNickname(), user.getProvider().name());
    }
}
