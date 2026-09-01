package com.yarmirror.backend.spot.storage;

/**
 * Storage boundary for spot photos. Implementations map a public URL back to their own object key,
 * so the domain only ever persists {@code photoUrl}.
 */
public interface ObjectStoragePort {

    PresignedUpload presignUpload(String objectKey, String contentType);

    String publicUrl(String objectKey);

    /** HEAD-equivalent existence check used to confirm that the client upload actually landed. */
    boolean objectExistsAtUrl(String photoUrl);
}
