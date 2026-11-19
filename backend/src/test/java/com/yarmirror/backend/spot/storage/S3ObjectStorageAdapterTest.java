package com.yarmirror.backend.spot.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.yarmirror.backend.config.StorageProperties;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * 서명 계산은 네트워크 없이 실제 {@link S3Presigner}로 검증하고, {@code HEAD}/{@code DELETE}는 모킹한
 * {@link S3Client}로 검증한다.
 */
class S3ObjectStorageAdapterTest {

    private static final String ENDPOINT = "https://account-id.r2.cloudflarestorage.com";
    private static final String BUCKET = "yar-mirror-photos";
    private static final String PUBLIC_BASE_URL = "https://photos.example.com/";
    private static final String OBJECT_KEY = "spots/2f1c9b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b.jpg";

    private final S3Client s3Client = mock(S3Client.class);
    private final S3Presigner presigner = S3Presigner.builder()
            .endpointOverride(URI.create(ENDPOINT))
            .region(Region.of("auto"))
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("key-id", "secret")))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
            .build();
    private final S3ObjectStorageAdapter adapter = new S3ObjectStorageAdapter(
            s3Client, presigner, new StorageProperties(BUCKET, PUBLIC_BASE_URL, 600, "unused"));

    @AfterEach
    void closePresigner() {
        presigner.close();
    }

    @Test
    void presignsAPathStylePutUrlThatSignsTheContentType() {
        // given
        Instant before = Instant.now();

        // when
        PresignedUpload upload = adapter.presignUpload(OBJECT_KEY, "image/jpeg");

        // then
        assertThat(upload.objectKey()).isEqualTo(OBJECT_KEY);
        assertThat(upload.httpMethod()).isEqualTo("PUT");
        assertThat(upload.uploadUrl()).startsWith(ENDPOINT + "/" + BUCKET + "/" + OBJECT_KEY + "?");
        assertThat(upload.uploadUrl())
                .contains("X-Amz-Expires=600")
                .containsPattern("X-Amz-SignedHeaders=[^&]*content-type");
        assertThat(upload.expiresAt())
                .isBetween(before.plus(Duration.ofSeconds(599)), Instant.now().plus(Duration.ofSeconds(601)));
    }

    @Test
    void presignedUrlDoesNotRequireChecksumHeadersFromTheClient() {
        // given — 클라이언트(모바일·웹)는 Content-Type 외의 헤더를 보내지 않는다.

        // when
        PresignedUpload upload = adapter.presignUpload(OBJECT_KEY, "image/jpeg");

        // then
        assertThat(upload.uploadUrl().toLowerCase()).doesNotContain("checksum");
    }

    @Test
    void refusesToPresignKeysItDidNotMint() {
        // given
        String foreignKey = "../escape.jpg";

        // when / then
        assertThatThrownBy(() -> adapter.presignUpload(foreignKey, "image/jpeg"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void publicUrlUsesTheCustomDomain() {
        // when
        String url = adapter.publicUrl(OBJECT_KEY);

        // then
        assertThat(url).isEqualTo("https://photos.example.com/" + OBJECT_KEY);
    }

    @Test
    void objectExistsWhenHeadSucceeds() {
        // given
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().contentLength(300_000L).build());

        // when
        boolean exists = adapter.objectExistsAtUrl(adapter.publicUrl(OBJECT_KEY));

        // then
        assertThat(exists).isTrue();
        verify(s3Client).headObject(HeadObjectRequest.builder().bucket(BUCKET).key(OBJECT_KEY).build());
    }

    @Test
    void objectDoesNotExistWhenHeadReturnsNoSuchKey() {
        // given
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().statusCode(404).build());

        // when
        boolean exists = adapter.objectExistsAtUrl(adapter.publicUrl(OBJECT_KEY));

        // then
        assertThat(exists).isFalse();
    }

    @Test
    void objectDoesNotExistWhenHeadReturnsA404WithoutAnErrorCode() {
        // given — HEAD 응답에는 본문이 없어 일반 S3Exception(404)으로 올 수도 있다.
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(404).build());

        // when
        boolean exists = adapter.objectExistsAtUrl(adapter.publicUrl(OBJECT_KEY));

        // then
        assertThat(exists).isFalse();
    }

    @Test
    void storageFailuresOtherThan404Propagate() {
        // given
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(500).build());

        // when / then
        assertThatThrownBy(() -> adapter.objectExistsAtUrl(adapter.publicUrl(OBJECT_KEY)))
                .isInstanceOf(S3Exception.class);
    }

    @Test
    void oversizedUploadsAreDeletedAndTreatedAsMissing() {
        // given
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder()
                        .contentLength(S3ObjectStorageAdapter.MAX_OBJECT_BYTES + 1)
                        .build());

        // when
        boolean exists = adapter.objectExistsAtUrl(adapter.publicUrl(OBJECT_KEY));

        // then
        assertThat(exists).isFalse();
        verify(s3Client).deleteObject(DeleteObjectRequest.builder().bucket(BUCKET).key(OBJECT_KEY).build());
    }

    @Test
    void urlsOutsideTheCustomDomainAreNeverLookedUp() {
        // given
        String foreignUrl = "https://evil.example.com/" + OBJECT_KEY;
        String traversalUrl = "https://photos.example.com/../secret.jpg";

        // when / then
        assertThat(adapter.objectExistsAtUrl(foreignUrl)).isFalse();
        assertThat(adapter.objectExistsAtUrl(traversalUrl)).isFalse();
        assertThat(adapter.objectExistsAtUrl(null)).isFalse();
        verify(s3Client, never()).headObject(any(HeadObjectRequest.class));
    }
}
