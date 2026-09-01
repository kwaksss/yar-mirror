package com.yarmirror.backend.spot.storage;

import java.time.Instant;

public record PresignedUpload(String objectKey, String uploadUrl, String httpMethod, Instant expiresAt) {
}
