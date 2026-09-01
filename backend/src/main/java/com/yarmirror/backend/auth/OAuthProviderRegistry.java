package com.yarmirror.backend.auth;

import com.yarmirror.backend.domain.AuthProvider;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class OAuthProviderRegistry {

    private final Map<AuthProvider, OAuthProviderAdapter> adapters;

    public OAuthProviderRegistry(List<OAuthProviderAdapter> adapters) {
        this.adapters = adapters.stream()
                .collect(Collectors.toUnmodifiableMap(OAuthProviderAdapter::provider, Function.identity()));
    }

    public OAuthProviderAdapter get(AuthProvider provider) {
        OAuthProviderAdapter adapter = adapters.get(provider);
        if (adapter == null) {
            throw new IllegalArgumentException("no adapter registered for provider: " + provider);
        }
        return adapter;
    }
}
