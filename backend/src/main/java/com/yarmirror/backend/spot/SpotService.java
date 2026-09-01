package com.yarmirror.backend.spot;

import com.yarmirror.backend.common.ForbiddenException;
import com.yarmirror.backend.common.NotFoundException;
import com.yarmirror.backend.config.SpotProperties;
import com.yarmirror.backend.domain.PhotoUploadStatus;
import com.yarmirror.backend.domain.Spot;
import com.yarmirror.backend.repository.SpotRepository;
import com.yarmirror.backend.repository.SpotWithDistanceProjection;
import com.yarmirror.backend.spot.dto.CreateSpotRequest;
import com.yarmirror.backend.spot.dto.CreateSpotResponse;
import com.yarmirror.backend.spot.dto.SpotDetailResponse;
import com.yarmirror.backend.spot.dto.SpotSummaryResponse;
import com.yarmirror.backend.spot.storage.ObjectStoragePort;
import com.yarmirror.backend.spot.storage.PresignedUpload;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SpotService {

    private static final Map<String, String> ALLOWED_CONTENT_TYPES = Map.of(
            "image/jpeg", "jpg",
            "image/jpg", "jpg",
            "image/png", "png",
            "image/webp", "webp");

    private final SpotRepository spotRepository;
    private final ObjectStoragePort objectStorage;
    private final SpotProperties spotProperties;

    public SpotService(
            SpotRepository spotRepository, ObjectStoragePort objectStorage, SpotProperties spotProperties) {
        this.spotRepository = spotRepository;
        this.objectStorage = objectStorage;
        this.spotProperties = spotProperties;
    }

    @Transactional(readOnly = true)
    public List<SpotSummaryResponse> findNearby(double latitude, double longitude, Double radiusMeters) {
        double radius = resolveRadius(radiusMeters);
        return spotRepository.findConfirmedWithin(latitude, longitude, radius).stream()
                .map(SpotService::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public SpotDetailResponse getDetail(Long spotId, Double latitude, Double longitude) {
        Spot spot = requireSpot(spotId);
        Double distance = (latitude == null || longitude == null)
                ? null
                : GeoDistance.haversineMeters(latitude, longitude, spot.getLatitude(), spot.getLongitude());
        return SpotDetailResponse.of(spot, distance);
    }

    @Transactional
    public CreateSpotResponse createSpot(Long uploaderId, CreateSpotRequest request) {
        String extension = ALLOWED_CONTENT_TYPES.get(request.contentType().toLowerCase());
        if (extension == null) {
            throw new IllegalArgumentException("unsupported contentType: " + request.contentType());
        }

        String objectKey = "spots/%s.%s".formatted(UUID.randomUUID(), extension);
        PresignedUpload upload = objectStorage.presignUpload(objectKey, request.contentType());
        String photoUrl = objectStorage.publicUrl(objectKey);

        Spot spot = spotRepository.save(Spot.pending(
                uploaderId,
                request.latitude(),
                request.longitude(),
                request.address(),
                request.name(),
                request.description(),
                photoUrl));

        return new CreateSpotResponse(
                spot.getId(),
                spot.getPhotoUploadStatus(),
                photoUrl,
                upload.uploadUrl(),
                upload.httpMethod(),
                upload.expiresAt());
    }

    @Transactional
    public SpotDetailResponse confirmUpload(Long uploaderId, Long spotId) {
        Spot spot = requireSpot(spotId);
        if (!spot.getUploaderId().equals(uploaderId)) {
            throw new ForbiddenException("only the uploader can confirm this spot's photo upload");
        }
        if (spot.isConfirmed()) {
            return SpotDetailResponse.of(spot, null);
        }
        if (!objectStorage.objectExistsAtUrl(spot.getPhotoUrl())) {
            throw new UploadNotFoundException("photo has not been uploaded for spot " + spotId);
        }
        spot.confirmPhotoUpload();
        spotRepository.save(spot);
        return SpotDetailResponse.of(spot, null);
    }

    private Spot requireSpot(Long spotId) {
        return spotRepository.findById(spotId).orElseThrow(() -> new NotFoundException("spot not found: " + spotId));
    }

    private double resolveRadius(Double requested) {
        if (requested == null) {
            return spotProperties.defaultRadiusMeters();
        }
        if (requested <= 0) {
            throw new IllegalArgumentException("radius must be greater than 0");
        }
        return Math.min(requested, spotProperties.maxRadiusMeters());
    }

    private static SpotSummaryResponse toSummary(SpotWithDistanceProjection projection) {
        return new SpotSummaryResponse(
                projection.getId(),
                projection.getName(),
                projection.getAddress(),
                projection.getDescription(),
                projection.getPhotoUrl(),
                PhotoUploadStatus.valueOf(projection.getPhotoUploadStatus()),
                projection.getLatitude(),
                projection.getLongitude(),
                projection.getDistanceMeters());
    }
}
