package com.yarmirror.backend.spot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class SpotServiceTest {

    private static final long UPLOADER_ID = 7L;
    private static final Instant EXPIRES_AT = Instant.parse("2026-01-01T00:10:00Z");

    @Mock
    private SpotRepository spotRepository;

    @Mock
    private ObjectStoragePort objectStorage;

    private SpotService spotService;

    @BeforeEach
    void setUp() {
        spotService = new SpotService(spotRepository, objectStorage, new SpotProperties(2000, 20000));
    }

    private static Spot spotWithId(long id, long uploaderId, PhotoUploadStatus status) {
        Spot spot = Spot.pending(
                uploaderId, 37.5663, 126.9779, "서울시 중구", "시청 거울", "전신 거울", "http://storage/spots/a.jpg");
        ReflectionTestUtils.setField(spot, "id", id);
        if (status == PhotoUploadStatus.CONFIRMED) {
            spot.confirmPhotoUpload();
        }
        return spot;
    }

    @Test
    void createSpotReturnsPresignedUrlAndPersistsPendingSpot() {
        CreateSpotRequest request =
                new CreateSpotRequest(37.5663, 126.9779, "시청 거울", "서울시 중구", "전신 거울", "image/jpeg");
        when(objectStorage.presignUpload(anyString(), anyString()))
                .thenAnswer(invocation -> new PresignedUpload(
                        invocation.getArgument(0), "http://storage/upload/" + invocation.getArgument(0, String.class),
                        "PUT", EXPIRES_AT));
        when(objectStorage.publicUrl(anyString()))
                .thenAnswer(invocation -> "http://storage/" + invocation.getArgument(0, String.class));
        when(spotRepository.save(any(Spot.class))).thenAnswer(invocation -> {
            Spot saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 55L);
            return saved;
        });

        CreateSpotResponse response = spotService.createSpot(UPLOADER_ID, request);

        assertThat(response.spotId()).isEqualTo(55L);
        assertThat(response.photoUploadStatus()).isEqualTo(PhotoUploadStatus.PENDING);
        assertThat(response.uploadUrl()).startsWith("http://storage/upload/spots/");
        assertThat(response.uploadMethod()).isEqualTo("PUT");
        assertThat(response.uploadUrlExpiresAt()).isEqualTo(EXPIRES_AT);

        ArgumentCaptor<Spot> captor = ArgumentCaptor.forClass(Spot.class);
        verify(spotRepository).save(captor.capture());
        Spot saved = captor.getValue();
        assertThat(saved.getPhotoUploadStatus()).isEqualTo(PhotoUploadStatus.PENDING);
        assertThat(saved.getUploaderId()).isEqualTo(UPLOADER_ID);
        assertThat(saved.getPhotoUrl()).isEqualTo(response.photoUrl());
        assertThat(saved.getLocation().getX()).isEqualTo(126.9779);
        assertThat(saved.getLocation().getY()).isEqualTo(37.5663);
        assertThat(saved.getLocation().getSRID()).isEqualTo(4326);
    }

    @Test
    void createSpotRejectsUnsupportedContentType() {
        CreateSpotRequest request =
                new CreateSpotRequest(37.5663, 126.9779, "시청 거울", null, null, "application/pdf");

        assertThatThrownBy(() -> spotService.createSpot(UPLOADER_ID, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unsupported contentType");
        verify(spotRepository, never()).save(any(Spot.class));
    }

    @Test
    void confirmUploadFlipsToConfirmedWhenStorageHasTheObject() {
        Spot spot = spotWithId(55L, UPLOADER_ID, PhotoUploadStatus.PENDING);
        when(spotRepository.findById(55L)).thenReturn(Optional.of(spot));
        when(objectStorage.objectExistsAtUrl(spot.getPhotoUrl())).thenReturn(true);

        SpotDetailResponse response = spotService.confirmUpload(UPLOADER_ID, 55L);

        assertThat(response.photoUploadStatus()).isEqualTo(PhotoUploadStatus.CONFIRMED);
        assertThat(spot.getPhotoUploadStatus()).isEqualTo(PhotoUploadStatus.CONFIRMED);
        verify(spotRepository).save(spot);
    }

    @Test
    void confirmUploadLeavesSpotPendingWhenStorageHasNoObject() {
        Spot spot = spotWithId(55L, UPLOADER_ID, PhotoUploadStatus.PENDING);
        when(spotRepository.findById(55L)).thenReturn(Optional.of(spot));
        when(objectStorage.objectExistsAtUrl(spot.getPhotoUrl())).thenReturn(false);

        assertThatThrownBy(() -> spotService.confirmUpload(UPLOADER_ID, 55L))
                .isInstanceOf(UploadNotFoundException.class);

        assertThat(spot.getPhotoUploadStatus()).isEqualTo(PhotoUploadStatus.PENDING);
        verify(spotRepository, never()).save(any(Spot.class));
    }

    @Test
    void confirmUploadIsIdempotentAndSkipsStorageForAlreadyConfirmedSpots() {
        Spot spot = spotWithId(55L, UPLOADER_ID, PhotoUploadStatus.CONFIRMED);
        when(spotRepository.findById(55L)).thenReturn(Optional.of(spot));

        SpotDetailResponse response = spotService.confirmUpload(UPLOADER_ID, 55L);

        assertThat(response.photoUploadStatus()).isEqualTo(PhotoUploadStatus.CONFIRMED);
        verify(objectStorage, never()).objectExistsAtUrl(anyString());
        verify(spotRepository, never()).save(any(Spot.class));
    }

    @Test
    void confirmUploadRejectsSomeoneElsesSpot() {
        Spot spot = spotWithId(55L, UPLOADER_ID, PhotoUploadStatus.PENDING);
        when(spotRepository.findById(55L)).thenReturn(Optional.of(spot));

        assertThatThrownBy(() -> spotService.confirmUpload(999L, 55L)).isInstanceOf(ForbiddenException.class);

        assertThat(spot.getPhotoUploadStatus()).isEqualTo(PhotoUploadStatus.PENDING);
        verify(objectStorage, never()).objectExistsAtUrl(anyString());
    }

    @Test
    void confirmUploadFailsForUnknownSpot() {
        when(spotRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> spotService.confirmUpload(UPLOADER_ID, 404L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void findNearbyAppliesDefaultRadiusAndMapsProjections() {
        when(spotRepository.findConfirmedWithin(37.5663, 126.9779, 2000))
                .thenReturn(List.of(projection(1L, "시청 거울", 37.5663, 126.9779, 12.5)));

        List<SpotSummaryResponse> results = spotService.findNearby(37.5663, 126.9779, null);

        assertThat(results).hasSize(1);
        assertThat(results.get(0).id()).isEqualTo(1L);
        assertThat(results.get(0).name()).isEqualTo("시청 거울");
        assertThat(results.get(0).description()).isEqualTo("전신 거울");
        assertThat(results.get(0).photoUploadStatus()).isEqualTo(PhotoUploadStatus.CONFIRMED);
        assertThat(results.get(0).distanceMeters()).isEqualTo(12.5);
    }

    @Test
    void findNearbyCapsRadiusAtTheConfiguredMaximum() {
        when(spotRepository.findConfirmedWithin(37.5663, 126.9779, 20000)).thenReturn(List.of());

        assertThat(spotService.findNearby(37.5663, 126.9779, 999999.0)).isEmpty();
    }

    @Test
    void findNearbyRejectsNonPositiveRadius() {
        assertThatThrownBy(() -> spotService.findNearby(37.5663, 126.9779, 0.0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void getDetailComputesDistanceFromTheQueryCoordinatesWhenProvided() {
        Spot spot = spotWithId(55L, UPLOADER_ID, PhotoUploadStatus.CONFIRMED);
        when(spotRepository.findById(55L)).thenReturn(Optional.of(spot));

        SpotDetailResponse withCoords = spotService.getDetail(55L, 37.4979, 127.0276);

        assertThat(withCoords.distanceMeters()).isCloseTo(8815, within(100.0));
        assertThat(withCoords.address()).isEqualTo("서울시 중구");
        assertThat(withCoords.photoUrl()).isEqualTo(spot.getPhotoUrl());
    }

    @Test
    void getDetailOmitsDistanceWhenQueryCoordinatesAreMissing() {
        Spot spot = spotWithId(55L, UPLOADER_ID, PhotoUploadStatus.CONFIRMED);
        when(spotRepository.findById(55L)).thenReturn(Optional.of(spot));

        assertThat(spotService.getDetail(55L, null, null).distanceMeters()).isNull();
    }

    private static SpotWithDistanceProjection projection(
            Long id, String name, double lat, double lng, double distanceMeters) {
        return new SpotWithDistanceProjection() {
            @Override
            public Long getId() {
                return id;
            }

            @Override
            public String getName() {
                return name;
            }

            @Override
            public String getAddress() {
                return "서울시 중구";
            }

            @Override
            public String getDescription() {
                return "전신 거울";
            }

            @Override
            public String getPhotoUrl() {
                return "http://storage/spots/a.jpg";
            }

            @Override
            public String getPhotoUploadStatus() {
                return "CONFIRMED";
            }

            @Override
            public Double getLatitude() {
                return lat;
            }

            @Override
            public Double getLongitude() {
                return lng;
            }

            @Override
            public Double getDistanceMeters() {
                return distanceMeters;
            }
        };
    }
}
