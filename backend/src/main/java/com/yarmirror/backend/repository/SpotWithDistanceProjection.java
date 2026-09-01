package com.yarmirror.backend.repository;

public interface SpotWithDistanceProjection {

    Long getId();

    String getName();

    String getAddress();

    String getDescription();

    String getPhotoUrl();

    String getPhotoUploadStatus();

    Double getLatitude();

    Double getLongitude();

    Double getDistanceMeters();
}
