package com.yarmirror.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.spot")
public record SpotProperties(double defaultRadiusMeters, double maxRadiusMeters) {
}
