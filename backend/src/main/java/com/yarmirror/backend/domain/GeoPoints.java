package com.yarmirror.backend.domain;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;

public final class GeoPoints {

    private static final int WGS84_SRID = 4326;

    private static final GeometryFactory FACTORY =
            new GeometryFactory(new PrecisionModel(PrecisionModel.FLOATING), WGS84_SRID);

    private GeoPoints() {
    }

    /** PostGIS point ordering is (longitude, latitude). */
    public static Point of(double latitude, double longitude) {
        return FACTORY.createPoint(new Coordinate(longitude, latitude));
    }
}
