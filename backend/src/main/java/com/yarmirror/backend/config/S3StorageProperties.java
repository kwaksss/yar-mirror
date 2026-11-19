package com.yarmirror.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * S3 호환 오브젝트 스토리지(Cloudflare R2) 접속 설정. {@code app.storage.type=s3}일 때만 사용된다.
 *
 * <ul>
 *   <li>{@code endpoint} — 예: {@code https://<account-id>.r2.cloudflarestorage.com}</li>
 *   <li>{@code region} — R2는 {@code auto}</li>
 *   <li>{@code accessKeyId} / {@code secretAccessKey} — 사진 버킷 전용 R2 API 토큰</li>
 * </ul>
 */
@ConfigurationProperties(prefix = "app.storage.s3")
public record S3StorageProperties(String endpoint, String region, String accessKeyId, String secretAccessKey) {

    @Override
    public String toString() {
        // 비밀 키가 로그·예외 메시지에 찍히지 않도록 가린다.
        return "S3StorageProperties[endpoint=%s, region=%s, accessKeyId=%s, secretAccessKey=***]"
                .formatted(endpoint, region, accessKeyId);
    }
}
