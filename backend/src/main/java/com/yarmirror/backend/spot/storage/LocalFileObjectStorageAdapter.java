package com.yarmirror.backend.spot.storage;

import com.yarmirror.backend.config.StorageProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Local filesystem stand-in for S3-compatible storage: the MVP has no cloud credentials yet, so
 * presigning is simulated and the HEAD check becomes a file lookup under {@code app.storage.local-root}.
 * Bytes arrive through {@link LocalStorageUploadController}; with real S3 both classes are deleted and
 * clients PUT straight to the bucket.
 */
@Component
public class LocalFileObjectStorageAdapter implements ObjectStoragePort {

    /** Only keys this adapter itself mints are accepted, which also rules out path traversal. */
    private static final Pattern OBJECT_KEY =
            Pattern.compile("spots/[0-9a-fA-F-]{36}\\.(jpg|png|webp)");

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
        return trimTrailingSlash(properties.publicBaseUrl()) + "/" + objectKey;
    }

    @Override
    public boolean objectExistsAtUrl(String photoUrl) {
        String objectKey = objectKeyOf(photoUrl);
        return objectKey != null && Files.isRegularFile(resolve(objectKey));
    }

    public void store(String objectKey, byte[] content) throws IOException {
        Path target = resolve(objectKey);
        Files.createDirectories(target.getParent());
        Files.write(target, content);
    }

    public Path resolve(String objectKey) {
        if (objectKey == null || !OBJECT_KEY.matcher(objectKey).matches()) {
            throw new IllegalArgumentException("unsupported object key: " + objectKey);
        }
        return Path.of(properties.localRoot()).resolve(objectKey).normalize();
    }

    private String objectKeyOf(String photoUrl) {
        if (photoUrl == null) {
            return null;
        }
        String prefix = trimTrailingSlash(properties.publicBaseUrl()) + "/";
        if (!photoUrl.startsWith(prefix)) {
            return null;
        }
        String key = photoUrl.substring(prefix.length());
        return OBJECT_KEY.matcher(key).matches() ? key : null;
    }

    private static String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
