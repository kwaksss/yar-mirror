package com.yarmirror.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.yarmirror.backend.spot.storage.LocalFileObjectStorageAdapter;
import com.yarmirror.backend.spot.storage.LocalStorageUploadController;
import com.yarmirror.backend.spot.storage.ObjectStoragePort;
import com.yarmirror.backend.spot.storage.S3ObjectStorageAdapter;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

/** {@code app.storage.type}에 따라 스토리지 어댑터가 하나만 등록되는지 검증한다. */
class S3StorageConfigTest {

    private static final String[] S3_PROPERTIES = {
        "app.storage.type=s3",
        "app.storage.bucket=yar-mirror-photos",
        "app.storage.public-base-url=https://photos.example.com",
        "app.storage.presigned-url-ttl-seconds=600",
        "app.storage.s3.endpoint=https://account-id.r2.cloudflarestorage.com",
        "app.storage.s3.region=auto",
        "app.storage.s3.access-key-id=key-id",
        "app.storage.s3.secret-access-key=secret"
    };

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(StorageTestConfig.class);

    @Test
    void s3TypeRegistersOnlyTheS3Adapter() {
        // given
        ApplicationContextRunner s3Runner = runner.withPropertyValues(S3_PROPERTIES);

        // when / then
        s3Runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(ObjectStoragePort.class)).isInstanceOf(S3ObjectStorageAdapter.class);
            assertThat(context).doesNotHaveBean(LocalFileObjectStorageAdapter.class);
            assertThat(context).doesNotHaveBean(LocalStorageUploadController.class);
        });
    }

    @Test
    void missingTypeFallsBackToTheLocalAdapter() {
        // given
        ApplicationContextRunner localRunner = runner.withPropertyValues(
                "app.storage.bucket=yar-mirror-local",
                "app.storage.public-base-url=http://localhost:8080/local-storage",
                "app.storage.presigned-url-ttl-seconds=600",
                "app.storage.local-root=./.local-storage");

        // when / then
        localRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(ObjectStoragePort.class)).isInstanceOf(LocalFileObjectStorageAdapter.class);
            assertThat(context).hasSingleBean(LocalStorageUploadController.class);
            assertThat(context).doesNotHaveBean(S3ObjectStorageAdapter.class);
        });
    }

    @Test
    void s3TypeFailsFastWhenCredentialsAreMissing() {
        // given
        ApplicationContextRunner incomplete = runner.withPropertyValues(S3_PROPERTIES)
                .withPropertyValues("app.storage.s3.secret-access-key=");

        // when / then
        incomplete.run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).rootCause().hasMessageContaining("STORAGE_SECRET_ACCESS_KEY");
        });
    }

    @Test
    void s3TypeFailsFastWhenTheEndpointStillContainsTheBucketPath() {
        // given — 대시보드 "S3 API" 주소를 버킷 이름까지 그대로 붙여 넣은 경우
        ApplicationContextRunner withBucketPath = runner.withPropertyValues(S3_PROPERTIES)
                .withPropertyValues(
                        "app.storage.s3.endpoint=https://account-id.r2.cloudflarestorage.com/yar-mirror-photos");

        // when / then
        withBucketPath.run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).rootCause()
                    .hasMessageContaining("must not contain a path")
                    .hasMessageContaining("/yar-mirror-photos");
        });
    }

    @Test
    void unknownStorageTypeFailsFastWithTheOffendingValue() {
        // given — .env 값 뒤에 인라인 주석이 붙은 경우
        ApplicationContextRunner typo = runner.withPropertyValues(S3_PROPERTIES)
                .withPropertyValues("app.storage.type=s3   # local only");

        // when / then
        typo.run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).rootCause()
                    .hasMessageContaining("must be 'local' or 's3'")
                    .hasMessageContaining("# local only");
        });
    }

    @Configuration
    @EnableConfigurationProperties({StorageProperties.class, S3StorageProperties.class})
    @Import({
        StorageTypeGuard.class,
        S3StorageConfig.class,
        LocalFileObjectStorageAdapter.class,
        LocalStorageUploadController.class
    })
    static class StorageTestConfig {

        @Bean
        Clock clock() {
            return Clock.systemUTC();
        }
    }
}
