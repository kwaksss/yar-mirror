package com.yarmirror.backend.spot.dto;

import com.yarmirror.backend.domain.PhotoUploadStatus;
import java.time.Instant;

public record CreateSpotResponse(
        Long spotId,
        PhotoUploadStatus photoUploadStatus,
        String photoUrl,
        String uploadUrl,
        String uploadMethod,
        Instant uploadUrlExpiresAt) {
}
