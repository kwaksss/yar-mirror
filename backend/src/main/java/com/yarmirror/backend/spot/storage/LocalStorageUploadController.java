package com.yarmirror.backend.spot.storage;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Development stand-in for an S3 bucket accepting a presigned PUT. Replace both this controller and
 * {@link LocalFileObjectStorageAdapter} with a real S3 adapter once credentials exist — clients will
 * then upload directly to the bucket and this endpoint disappears.
 */
@RestController
@RequestMapping("/local-storage")
public class LocalStorageUploadController {

    private static final int MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

    private final LocalFileObjectStorageAdapter storage;

    public LocalStorageUploadController(LocalFileObjectStorageAdapter storage) {
        this.storage = storage;
    }

    @PutMapping("/**")
    public ResponseEntity<Void> upload(HttpServletRequest request, InputStream body) throws IOException {
        String objectKey = objectKeyOf(request);
        byte[] content = body.readNBytes(MAX_UPLOAD_BYTES + 1);
        if (content.length == 0) {
            return ResponseEntity.badRequest().build();
        }
        if (content.length > MAX_UPLOAD_BYTES) {
            return ResponseEntity.status(413).build();
        }
        storage.store(objectKey, content);
        return ResponseEntity.noContent().build();
    }

    /**
     * 업로드된 사진 바이트를 내려준다. S3의 공개 읽기(public-read) GET을 대신하므로 인증 없이 접근할 수 있다.
     *
     * <p>키 검증은 {@link LocalFileObjectStorageAdapter#resolve(String)}가 담당하며, 이 어댑터가 발급하지 않은
     * 형식의 키는 400, 업로드되지 않은 키는 404로 응답한다.
     */
    @GetMapping("/**")
    public ResponseEntity<Resource> download(HttpServletRequest request) {
        String objectKey = objectKeyOf(request);
        Path file = storage.resolve(objectKey);
        if (!Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(contentTypeOf(objectKey))
                .body(new FileSystemResource(file));
    }

    /** 오브젝트 키 확장자(jpg | png | webp)로 응답 Content-Type을 정한다. */
    private static MediaType contentTypeOf(String objectKey) {
        if (objectKey.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        if (objectKey.endsWith(".webp")) {
            return MediaType.parseMediaType("image/webp");
        }
        return MediaType.IMAGE_JPEG;
    }

    private String objectKeyOf(HttpServletRequest request) {
        String path = (String) request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE);
        if (path == null) {
            path = request.getRequestURI();
        }
        int prefixAt = path.indexOf("/local-storage/");
        if (prefixAt < 0) {
            throw new IllegalArgumentException("upload path is not under /local-storage/");
        }
        return path.substring(prefixAt + "/local-storage/".length());
    }
}
