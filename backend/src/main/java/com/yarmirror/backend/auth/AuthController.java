package com.yarmirror.backend.auth;

import com.yarmirror.backend.auth.dto.LoginRequest;
import com.yarmirror.backend.auth.dto.MeResponse;
import com.yarmirror.backend.auth.dto.RefreshRequest;
import com.yarmirror.backend.auth.dto.TokenResponse;
import com.yarmirror.backend.domain.AuthProvider;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login/{provider}")
    public TokenResponse login(@PathVariable String provider, @RequestBody LoginRequest request) {
        AuthProvider authProvider = AuthProvider.from(provider);
        return TokenResponse.from(authService.login(authProvider, request.toCommand()));
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return TokenResponse.from(authService.refresh(request.refreshToken()));
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal AuthenticatedUser principal) {
        return MeResponse.from(authService.getUser(principal.id()));
    }
}
