package com.yarmirror.backend.spot;

import com.yarmirror.backend.auth.AuthenticatedUser;
import com.yarmirror.backend.spot.dto.CreateSpotRequest;
import com.yarmirror.backend.spot.dto.CreateSpotResponse;
import com.yarmirror.backend.spot.dto.SpotDetailResponse;
import com.yarmirror.backend.spot.dto.SpotSummaryResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/spots")
public class SpotController {

    private final SpotService spotService;

    public SpotController(SpotService spotService) {
        this.spotService = spotService;
    }

    @GetMapping
    public List<SpotSummaryResponse> nearby(
            @RequestParam double lat, @RequestParam double lng, @RequestParam(required = false) Double radius) {
        return spotService.findNearby(lat, lng, radius);
    }

    @GetMapping("/{id}")
    public SpotDetailResponse detail(
            @PathVariable Long id,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng) {
        return spotService.getDetail(id, lat, lng);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CreateSpotResponse create(
            @AuthenticationPrincipal AuthenticatedUser principal, @Valid @RequestBody CreateSpotRequest request) {
        return spotService.createSpot(principal.id(), request);
    }

    @PostMapping("/{id}/confirm-upload")
    public SpotDetailResponse confirmUpload(
            @AuthenticationPrincipal AuthenticatedUser principal, @PathVariable Long id) {
        return spotService.confirmUpload(principal.id(), id);
    }
}
