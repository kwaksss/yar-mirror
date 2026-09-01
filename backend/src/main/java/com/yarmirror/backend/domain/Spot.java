package com.yarmirror.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import org.locationtech.jts.geom.Point;

@Entity
@Table(
        name = "spots",
        indexes = {
            @Index(name = "idx_spots_uploader_id", columnList = "uploader_id"),
            @Index(name = "idx_spots_photo_upload_status", columnList = "photo_upload_status")
        })
public class Spot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "uploader_id", nullable = false)
    private Long uploaderId;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(name = "location", nullable = false, columnDefinition = "geography(Point,4326)")
    private Point location;

    @Column(length = 255)
    private String address;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "photo_url", nullable = false, length = 512)
    private String photoUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "photo_upload_status", nullable = false, length = 20)
    private PhotoUploadStatus photoUploadStatus;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Spot() {
    }

    private Spot(
            Long uploaderId,
            double latitude,
            double longitude,
            String address,
            String name,
            String description,
            String photoUrl) {
        this.uploaderId = uploaderId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.address = address;
        this.name = name;
        this.description = description;
        this.photoUrl = photoUrl;
        this.photoUploadStatus = PhotoUploadStatus.PENDING;
        syncLocation();
    }

    public static Spot pending(
            Long uploaderId,
            double latitude,
            double longitude,
            String address,
            String name,
            String description,
            String photoUrl) {
        return new Spot(uploaderId, latitude, longitude, address, name, description, photoUrl);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        syncLocation();
    }

    @PreUpdate
    void onUpdate() {
        syncLocation();
    }

    private void syncLocation() {
        if (latitude != null && longitude != null) {
            this.location = GeoPoints.of(latitude, longitude);
        }
    }

    public void confirmPhotoUpload() {
        this.photoUploadStatus = PhotoUploadStatus.CONFIRMED;
    }

    public boolean isConfirmed() {
        return photoUploadStatus == PhotoUploadStatus.CONFIRMED;
    }

    public Long getId() {
        return id;
    }

    public Long getUploaderId() {
        return uploaderId;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public Point getLocation() {
        return location;
    }

    public String getAddress() {
        return address;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public PhotoUploadStatus getPhotoUploadStatus() {
        return photoUploadStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
