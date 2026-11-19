package com.yarmirror.backend.spot.storage;

import com.yarmirror.backend.config.StorageProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Local filesystem stand-in for S3-compatible storage: the MVP has no cloud credentials yet, so
 * presigning is simulated and the HEAD check becomes a file lookup under {@code app.storage.local-root}.
 * Bytes arrive through {@link LocalStorageUploadController}.
 *
 * <p>{@code app.storage.type=local}(기본값)일 때만 등록된다. 운영({@code prod})은 {@code s3}로
 * {@link S3ObjectStorageAdapter}를 쓰고, 클라이언트는 버킷에 직접 PUT한다.
 */
@Component
@ConditionalOnProperty(prefix = "app.storage", name = "type", havingValue = "local", matchIfMissing = true)
public class LocalFileObjectStorageAdapter implements ObjectStoragePort {

    private final StorageProperties properties;
    private final Clock clock;

    public LocalFileObjectStorageAdapter(StorageProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    public PresignedUpload presignUpload(String objectKey, String contentType) {
        Instant expiresAt = clock.instant().plusSeconds(properties.presignedUrlTtlSeconds());
        String uploadUrl = "%s/%s?upload=1&expires=%d".formatted(
                trimTrailingSlash(properties.publicBaseUrl()), objectKey, expiresAt.getEpochSecond());
        return new PresignedUpload(objectKey, uploadUrl, "PUT", expiresAt);
    }

    @Override
    public String publicUrl(String objectKey) {
        return ObjectKeys.publicUrl(properties.publicBaseUrl(), objectKey);
    }

    @Override
    public boolean objectExistsAtUrl(String photoUrl) {
        String objectKey = ObjectKeys.fromPublicUrl(properties.publicBaseUrl(), photoUrl);
        return objectKey != null && Files.isRegularFile(resolve(objectKey));
    }

    public void store(String objectKey, byte[] content) throws IOException {
        Path target = resolve(objectKey);
        Files.createDirectories(target.getParent());
        Files.write(target, content);
    }

    public Path resolve(String objectKey) {
        if (!ObjectKeys.isValid(objectKey)) {
            throw new IllegalArgumentException("unsupported object key: " + objectKey);
        }
        return Path.of(properties.localRoot()).resolve(objectKey).normalize();
    }

    private static String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
