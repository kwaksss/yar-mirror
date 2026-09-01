package com.yarmirror.backend.spot.storage;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import org.springframework.http.ResponseEntity;
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
