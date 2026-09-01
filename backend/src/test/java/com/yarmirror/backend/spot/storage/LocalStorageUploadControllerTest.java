package com.yarmirror.backend.spot.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.yarmirror.backend.auth.JwtAuthenticationFilter;
import com.yarmirror.backend.auth.JwtService;
import com.yarmirror.backend.config.SecurityConfig;
import com.yarmirror.backend.config.StorageProperties;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The presigned upload URL must be reachable without a JWT, exactly like the S3 PUT it stands in for.
 * Without this the whole PENDING -> CONFIRMED transition is unreachable.
 */
@WebMvcTest(LocalStorageUploadController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, LocalStorageUploadControllerTest.TestStorage.class})
class LocalStorageUploadControllerTest {

    @TempDir
    static Path storageRoot;

    private static final String OBJECT_KEY = "spots/2f1c9b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b.jpg";

    @TestConfiguration
    static class TestStorage {

        @Bean
        StorageProperties storageProperties() {
            return new StorageProperties(
                    "yar-mirror-local", "http://localhost:8080/local-storage", 600, storageRoot.toString());
        }

        @Bean
        Clock clock() {
            return Clock.systemUTC();
        }

        @Bean
        LocalFileObjectStorageAdapter localFileObjectStorageAdapter(StorageProperties properties, Clock clock) {
            return new LocalFileObjectStorageAdapter(properties, clock);
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private LocalFileObjectStorageAdapter storage;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void acceptsAnUnauthenticatedPutAndMakesTheObjectVisibleToConfirmUpload() throws Exception {
        String photoUrl = storage.publicUrl(OBJECT_KEY);
        assertThat(storage.objectExistsAtUrl(photoUrl)).isFalse();

        mockMvc.perform(put("/local-storage/" + OBJECT_KEY + "?upload=1&expires=1767225000")
                        .content("photo-bytes".getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isNoContent());

        assertThat(storage.objectExistsAtUrl(photoUrl)).isTrue();
        assertThat(Files.readString(storageRoot.resolve(OBJECT_KEY))).isEqualTo("photo-bytes");
    }

    @Test
    void rejectsAnEmptyBody() throws Exception {
        mockMvc.perform(put("/local-storage/" + OBJECT_KEY).content(new byte[0]))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAKeyItDidNotMint() throws Exception {
        mockMvc.perform(put("/local-storage/spots/not-a-uuid.jpg").content("x".getBytes(StandardCharsets.UTF_8)))
                .andExpect(status().isBadRequest());
    }
}
