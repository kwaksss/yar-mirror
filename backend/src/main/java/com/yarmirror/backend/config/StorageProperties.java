package com.yarmirror.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(
        String bucket, String publicBaseUrl, long presignedUrlTtlSeconds, String localRoot) {
}
