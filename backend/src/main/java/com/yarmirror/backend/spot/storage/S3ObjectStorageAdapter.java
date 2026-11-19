package com.yarmirror.backend.spot.storage;

import com.yarmirror.backend.config.StorageProperties;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

/**
 * S3 호환 오브젝트 스토리지(운영: Cloudflare R2) 어댑터.
 *
 * <p>업로드 흐름:
 * <ol>
 *   <li>{@link #presignUpload} — {@code Content-Type}을 서명에 포함한 PUT URL을 발급한다. 클라이언트는 같은
 *       {@code Content-Type} 헤더로 버킷에 직접 PUT해야 하며, 사진 바이트는 API 서버를 거치지 않는다.</li>
 *   <li>{@link #objectExistsAtUrl} — {@code HEAD}로 업로드 여부를 확인한다.</li>
 * </ol>
 *
 * <p>presigned PUT은 업로드 크기를 제한할 수 없으므로, 확인 단계에서 {@link #MAX_OBJECT_BYTES}를 넘는
 * 오브젝트는 삭제하고 "업로드되지 않음"으로 처리한다. 공개 URL은 버킷에 연결된 커스텀 도메인
 * ({@code app.storage.public-base-url})을 기준으로 만든다.
 */
public class S3ObjectStorageAdapter implements ObjectStoragePort {

    /** 허용하는 사진 최대 크기. 로컬 업로드 엔드포인트의 상한과 같다. */
    static final long MAX_OBJECT_BYTES = 10L * 1024 * 1024;

    private static final Logger log = LoggerFactory.getLogger(S3ObjectStorageAdapter.class);

    private final S3Client s3Client;
    private final S3Presigner presigner;
    private final StorageProperties properties;

    public S3ObjectStorageAdapter(S3Client s3Client, S3Presigner presigner, StorageProperties properties) {
        this.s3Client = s3Client;
        this.presigner = presigner;
        this.properties = properties;
    }

    @Override
    public PresignedUpload presignUpload(String objectKey, String contentType) {
        requireValidKey(objectKey);
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(properties.bucket())
                .key(objectKey)
                .contentType(contentType)
                .build();
        PresignedPutObjectRequest presigned = presigner.presignPutObject(request -> request
                .signatureDuration(Duration.ofSeconds(properties.presignedUrlTtlSeconds()))
                .putObjectRequest(putRequest));
        return new PresignedUpload(objectKey, presigned.url().toString(), "PUT", presigned.expiration());
    }

    @Override
    public String publicUrl(String objectKey) {
        return ObjectKeys.publicUrl(properties.publicBaseUrl(), objectKey);
    }

    /**
     * 공개 URL이 가리키는 오브젝트가 버킷에 있는지 {@code HEAD}로 확인한다.
     *
     * <p>설정된 공개 도메인 밖의 URL이나 형식이 맞지 않는 키는 조회하지 않고 {@code false}를 돌려준다.
     * 404 이외의 스토리지 오류는 그대로 던져, 일시 장애가 "업로드 없음"으로 오인되지 않게 한다.
     */
    @Override
    public boolean objectExistsAtUrl(String photoUrl) {
        String objectKey = ObjectKeys.fromPublicUrl(properties.publicBaseUrl(), photoUrl);
        if (objectKey == null) {
            return false;
        }
        HeadObjectResponse head;
        try {
            head = s3Client.headObject(
                    HeadObjectRequest.builder().bucket(properties.bucket()).key(objectKey).build());
        } catch (NoSuchKeyException e) {
            return false;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return false;
            }
            throw e;
        }
        Long size = head.contentLength();
        if (size != null && size > MAX_OBJECT_BYTES) {
            log.warn("deleting oversized upload {} ({} bytes > {} bytes)", objectKey, size, MAX_OBJECT_BYTES);
            s3Client.deleteObject(
                    DeleteObjectRequest.builder().bucket(properties.bucket()).key(objectKey).build());
            return false;
        }
        return true;
    }

    private static void requireValidKey(String objectKey) {
        if (!ObjectKeys.isValid(objectKey)) {
            throw new IllegalArgumentException("unsupported object key: " + objectKey);
        }
    }
}
