package com.yarmirror.backend.repository;

import com.yarmirror.backend.domain.Spot;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SpotRepository extends JpaRepository<Spot, Long> {

    @Query(
            value =
                    """
                    SELECT s.id                  AS "id",
                           s.name                AS "name",
                           s.address             AS "address",
                           s.description         AS "description",
                           s.photo_url           AS "photoUrl",
                           s.photo_upload_status AS "photoUploadStatus",
                           s.latitude            AS "latitude",
                           s.longitude           AS "longitude",
                           ST_Distance(s.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
                                               AS "distanceMeters"
                    FROM spots s
                    WHERE s.photo_upload_status = 'CONFIRMED'
                      AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radiusMeters)
                    ORDER BY "distanceMeters"
                    """,
            nativeQuery = true)
    List<SpotWithDistanceProjection> findConfirmedWithin(
            @Param("lat") double latitude, @Param("lng") double longitude, @Param("radiusMeters") double radiusMeters);
}
