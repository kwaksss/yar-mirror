package com.yarmirror.backend.config;

import com.yarmirror.backend.spot.storage.S3ObjectStorageAdapter;
import java.net.URI;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * {@code app.storage.type=s3}일 때 S3 호환 스토리지(Cloudflare R2) 클라이언트와 어댑터를 등록한다.
 *
 * <p>R2 호환을 위한 설정:
 * <ul>
 *   <li>path-style 주소({@code https://<endpoint>/<bucket>/<key>})를 쓴다.</li>
 *   <li>SDK 2.30부터 기본으로 붙는 체크섬 헤더는 필요한 경우에만 보낸다(R2 호환, presigned URL 단순화).</li>
 * </ul>
 * 필수 설정이 비어 있으면 기동 시점에 실패시켜, 잘못된 설정으로 운영이 시작되지 않게 한다.
 */
@Configuration
@ConditionalOnProperty(prefix = "app.storage", name = "type", havingValue = "s3")
public class S3StorageConfig {

    @Bean(destroyMethod = "close")
    public S3Client s3Client(S3StorageProperties s3) {
        validate(s3);
        return S3Client.builder()
                .endpointOverride(URI.create(s3.endpoint()))
                .region(Region.of(s3.region()))
                .credentialsProvider(credentials(s3))
                .forcePathStyle(true)
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }

    @Bean(destroyMethod = "close")
    public S3Presigner s3Presigner(S3StorageProperties s3) {
        validate(s3);
        return S3Presigner.builder()
                .endpointOverride(URI.create(s3.endpoint()))
                .region(Region.of(s3.region()))
                .credentialsProvider(credentials(s3))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
    }

    @Bean
    public S3ObjectStorageAdapter s3ObjectStorageAdapter(
            S3Client s3Client, S3Presigner s3Presigner, StorageProperties storageProperties) {
        requireText(storageProperties.bucket(), "app.storage.bucket");
        requireText(storageProperties.publicBaseUrl(), "app.storage.public-base-url");
        return new S3ObjectStorageAdapter(s3Client, s3Presigner, storageProperties);
    }

    private static StaticCredentialsProvider credentials(S3StorageProperties s3) {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(s3.accessKeyId(), s3.secretAccessKey()));
    }

    private static void validate(S3StorageProperties s3) {
        requireText(s3.endpoint(), "app.storage.s3.endpoint (STORAGE_ENDPOINT)");
        requireText(s3.region(), "app.storage.s3.region (STORAGE_REGION)");
        requireText(s3.accessKeyId(), "app.storage.s3.access-key-id (STORAGE_ACCESS_KEY_ID)");
        requireText(s3.secretAccessKey(), "app.storage.s3.secret-access-key (STORAGE_SECRET_ACCESS_KEY)");
        // 대시보드의 "S3 API" 주소는 끝에 버킷 이름이 붙어 있다. 그대로 넣으면 path-style 주소에 버킷이 두 번 들어가
        // 업로드·HEAD는 성공하지만 키가 "<bucket>/spots/..."로 저장되어 공개 URL에서 404가 난다.
        String path = URI.create(s3.endpoint()).getPath();
        if (path != null && !path.isEmpty() && !"/".equals(path)) {
            throw new IllegalStateException("app.storage.s3.endpoint (STORAGE_ENDPOINT) must not contain a path"
                    + "; remove the trailing bucket name (\"" + path + "\")");
        }
    }

    private static void requireText(String value, String name) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException(name + " must be set when app.storage.type=s3");
        }
    }
}
