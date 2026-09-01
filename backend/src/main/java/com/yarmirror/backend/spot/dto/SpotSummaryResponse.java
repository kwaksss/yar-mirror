package com.yarmirror.backend.spot.dto;

import com.yarmirror.backend.domain.PhotoUploadStatus;

public record SpotSummaryResponse(
        Long id,
        String name,
        String address,
        String description,
        String photoUrl,
        PhotoUploadStatus photoUploadStatus,
        double latitude,
        double longitude,
        double distanceMeters) {
}
