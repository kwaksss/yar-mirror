package com.yarmirror.backend.spot.dto;

import com.yarmirror.backend.domain.PhotoUploadStatus;
import com.yarmirror.backend.domain.Spot;
import java.time.Instant;

public record SpotDetailResponse(
        Long id,
        String name,
        String address,
        String description,
        String photoUrl,
        PhotoUploadStatus photoUploadStatus,
        double latitude,
        double longitude,
        Double distanceMeters,
        Long uploaderId,
        Instant createdAt) {

    public static SpotDetailResponse of(Spot spot, Double distanceMeters) {
        return new SpotDetailResponse(
                spot.getId(),
                spot.getName(),
                spot.getAddress(),
                spot.getDescription(),
                spot.getPhotoUrl(),
                spot.getPhotoUploadStatus(),
                spot.getLatitude(),
                spot.getLongitude(),
                distanceMeters,
                spot.getUploaderId(),
                spot.getCreatedAt());
    }
}
