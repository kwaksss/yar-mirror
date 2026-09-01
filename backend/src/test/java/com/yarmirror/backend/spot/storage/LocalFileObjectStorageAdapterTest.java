package com.yarmirror.backend.spot.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.yarmirror.backend.config.StorageProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalFileObjectStorageAdapterTest {

    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");
    private static final String OBJECT_KEY = "spots/2f1c9b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b.jpg";

    @TempDir
    Path storageRoot;

    private LocalFileObjectStorageAdapter adapter() {
        StorageProperties properties = new StorageProperties(
                "yar-mirror-local", "http://localhost:8080/local-storage/", 600, storageRoot.toString());
        return new LocalFileObjectStorageAdapter(properties, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void presignsAnUploadUrlThatExpiresAfterTheConfiguredTtl() {
        PresignedUpload upload = adapter().presignUpload(OBJECT_KEY, "image/jpeg");

        assertThat(upload.objectKey()).isEqualTo(OBJECT_KEY);
        assertThat(upload.httpMethod()).isEqualTo("PUT");
        assertThat(upload.expiresAt()).isEqualTo(NOW.plusSeconds(600));
        assertThat(upload.uploadUrl())
                .startsWith("http://localhost:8080/local-storage/" + OBJECT_KEY + "?upload=1");
    }

    @Test
    void storeMakesTheObjectVisibleToTheHeadCheck() throws IOException {
        LocalFileObjectStorageAdapter adapter = adapter();
        String photoUrl = adapter.publicUrl(OBJECT_KEY);

        assertThat(adapter.objectExistsAtUrl(photoUrl)).isFalse();

        adapter.store(OBJECT_KEY, "photo-bytes".getBytes(StandardCharsets.UTF_8));

        assertThat(adapter.objectExistsAtUrl(photoUrl)).isTrue();
        assertThat(Files.readString(storageRoot.resolve(OBJECT_KEY))).isEqualTo("photo-bytes");
    }

    @Test
    void rejectsUrlsOutsideTheConfiguredBaseAndTraversalAttempts() throws IOException {
        LocalFileObjectStorageAdapter adapter = adapter();
        Files.writeString(storageRoot.resolve("outside.txt"), "x");

        assertThat(adapter.objectExistsAtUrl("http://evil.example.com/" + OBJECT_KEY)).isFalse();
        assertThat(adapter.objectExistsAtUrl(null)).isFalse();
        assertThat(adapter.objectExistsAtUrl("http://localhost:8080/local-storage/../outside.txt"))
                .isFalse();
    }

    @Test
    void refusesToStoreKeysItDidNotMint() {
        LocalFileObjectStorageAdapter adapter = adapter();

        assertThatThrownBy(() -> adapter.store("../escape.jpg", new byte[] {1}))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> adapter.store("spots/not-a-uuid.jpg", new byte[] {1}))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> adapter.store("spots/2f1c9b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b.exe", new byte[] {1}))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
