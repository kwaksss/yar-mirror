package com.yarmirror.backend.spot;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.yarmirror.backend.auth.AuthenticatedUser;
import com.yarmirror.backend.auth.JwtAuthenticationFilter;
import com.yarmirror.backend.auth.JwtService;
import com.yarmirror.backend.config.SecurityConfig;
import com.yarmirror.backend.domain.PhotoUploadStatus;
import com.yarmirror.backend.spot.dto.CreateSpotResponse;
import com.yarmirror.backend.spot.dto.SpotDetailResponse;
import com.yarmirror.backend.spot.dto.SpotSummaryResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Pins the JSON the mobile client actually receives from /spots. POST /spots in particular returns a
 * flat body — no nested "spot" object — which the client must destructure accordingly.
 */
@WebMvcTest(SpotController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class SpotControllerContractTest {

    private static final Instant CREATED_AT = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant UPLOAD_EXPIRES_AT = Instant.parse("2026-01-01T00:10:00Z");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SpotService spotService;

    @MockitoBean
    private JwtService jwtService;

    private static RequestPostProcessor uploader() {
        return authentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(7L, "미러러"), null, List.of()));
    }

    @Test
    void createSpotReturnsAFlatBodyWithSpotIdAndUploadUrl() throws Exception {
        when(spotService.createSpot(eq(7L), any()))
                .thenReturn(new CreateSpotResponse(
                        55L,
                        PhotoUploadStatus.PENDING,
                        "http://localhost:8080/local-storage/spots/abc.jpg",
                        "http://localhost:8080/local-storage/spots/abc.jpg?upload=1&expires=1767225000",
                        "PUT",
                        UPLOAD_EXPIRES_AT));

        mockMvc.perform(post("/spots")
                        .with(uploader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {
                                  "latitude": 37.5663,
                                  "longitude": 126.9779,
                                  "name": "시청 거울",
                                  "address": "서울시 중구",
                                  "description": "전신 거울",
                                  "contentType": "image/jpeg"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.spotId").value(55))
                .andExpect(jsonPath("$.photoUploadStatus").value("PENDING"))
                .andExpect(jsonPath("$.photoUrl").value("http://localhost:8080/local-storage/spots/abc.jpg"))
                .andExpect(jsonPath("$.uploadUrl").exists())
                .andExpect(jsonPath("$.uploadMethod").value("PUT"))
                .andExpect(jsonPath("$.uploadUrlExpiresAt").value("2026-01-01T00:10:00Z"))
                // the response is flat: there is no nested "spot" object to destructure
                .andExpect(jsonPath("$.spot").doesNotExist())
                .andExpect(jsonPath("$.id").doesNotExist());
    }

    @Test
    void createSpotRequiresAuthenticationAndValidatesItsBody() throws Exception {
        mockMvc.perform(post("/spots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\":37.5,\"longitude\":127.0,\"name\":\"x\",\"contentType\":\"image/jpeg\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/spots")
                        .with(uploader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\":37.5,\"longitude\":127.0,\"contentType\":\"image/jpeg\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void nearbySpotsCarryPhotoUploadStatusAndDistance() throws Exception {
        when(spotService.findNearby(37.5663, 126.9779, 1500.0))
                .thenReturn(List.of(new SpotSummaryResponse(
                        55L,
                        "시청 거울",
                        "서울시 중구",
                        "전신 거울",
                        "http://localhost:8080/local-storage/spots/abc.jpg",
                        PhotoUploadStatus.CONFIRMED,
                        37.5663,
                        126.9779,
                        12.5)));

        mockMvc.perform(get("/spots")
                        .with(uploader())
                        .param("lat", "37.5663")
                        .param("lng", "126.9779")
                        .param("radius", "1500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(55))
                .andExpect(jsonPath("$[0].name").value("시청 거울"))
                .andExpect(jsonPath("$[0].address").value("서울시 중구"))
                .andExpect(jsonPath("$[0].description").value("전신 거울"))
                .andExpect(jsonPath("$[0].photoUrl").exists())
                .andExpect(jsonPath("$[0].photoUploadStatus").value("CONFIRMED"))
                .andExpect(jsonPath("$[0].latitude").value(37.5663))
                .andExpect(jsonPath("$[0].longitude").value(126.9779))
                .andExpect(jsonPath("$[0].distanceMeters").value(12.5));
    }

    @Test
    void nearbySpotsRequireLatAndLng() throws Exception {
        mockMvc.perform(get("/spots").with(uploader()).param("lat", "37.5663"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void spotDetailReturnsDistanceFromTheQueryCoordinates() throws Exception {
        when(spotService.getDetail(55L, 37.4979, 127.0276))
                .thenReturn(new SpotDetailResponse(
                        55L,
                        "시청 거울",
                        "서울시 중구",
                        "전신 거울",
                        "http://localhost:8080/local-storage/spots/abc.jpg",
                        PhotoUploadStatus.CONFIRMED,
                        37.5663,
                        126.9779,
                        8815.0,
                        7L,
                        CREATED_AT));

        mockMvc.perform(get("/spots/55").with(uploader()).param("lat", "37.4979").param("lng", "127.0276"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(55))
                .andExpect(jsonPath("$.photoUploadStatus").value("CONFIRMED"))
                .andExpect(jsonPath("$.distanceMeters").value(8815.0))
                .andExpect(jsonPath("$.uploaderId").value(7))
                .andExpect(jsonPath("$.createdAt").value("2026-01-01T00:00:00Z"));
    }

    @Test
    void confirmUploadReturnsConfirmedOnSuccessAndConflictWhenTheObjectIsMissing() throws Exception {
        when(spotService.confirmUpload(7L, 55L))
                .thenReturn(new SpotDetailResponse(
                        55L,
                        "시청 거울",
                        "서울시 중구",
                        "전신 거울",
                        "http://localhost:8080/local-storage/spots/abc.jpg",
                        PhotoUploadStatus.CONFIRMED,
                        37.5663,
                        126.9779,
                        null,
                        7L,
                        CREATED_AT));
        when(spotService.confirmUpload(7L, 56L)).thenThrow(new UploadNotFoundException("photo has not been uploaded"));

        mockMvc.perform(post("/spots/55/confirm-upload").with(uploader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photoUploadStatus").value("CONFIRMED"));

        mockMvc.perform(post("/spots/56/confirm-upload").with(uploader()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("UPLOAD_NOT_FOUND"));
    }
}
