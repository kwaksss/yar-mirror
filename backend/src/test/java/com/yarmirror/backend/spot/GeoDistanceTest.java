package com.yarmirror.backend.spot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class GeoDistanceTest {

    private static final double SEOUL_CITY_HALL_LAT = 37.5663;
    private static final double SEOUL_CITY_HALL_LNG = 126.9779;
    private static final double GANGNAM_STATION_LAT = 37.4979;
    private static final double GANGNAM_STATION_LNG = 127.0276;

    @Test
    void distanceToItselfIsZero() {
        assertThat(GeoDistance.haversineMeters(
                        SEOUL_CITY_HALL_LAT, SEOUL_CITY_HALL_LNG, SEOUL_CITY_HALL_LAT, SEOUL_CITY_HALL_LNG))
                .isZero();
    }

    @Test
    void matchesKnownDistanceBetweenSeoulCityHallAndGangnamStation() {
        double meters = GeoDistance.haversineMeters(
                SEOUL_CITY_HALL_LAT, SEOUL_CITY_HALL_LNG, GANGNAM_STATION_LAT, GANGNAM_STATION_LNG);

        assertThat(meters).isCloseTo(8815, within(100.0));
    }

    @Test
    void oneDegreeOfLatitudeIsAboutOneHundredEleventhKilometres() {
        double meters = GeoDistance.haversineMeters(37.0, 127.0, 38.0, 127.0);

        assertThat(meters).isCloseTo(111195, within(200.0));
    }

    @Test
    void isSymmetric() {
        double forward = GeoDistance.haversineMeters(
                SEOUL_CITY_HALL_LAT, SEOUL_CITY_HALL_LNG, GANGNAM_STATION_LAT, GANGNAM_STATION_LNG);
        double backward = GeoDistance.haversineMeters(
                GANGNAM_STATION_LAT, GANGNAM_STATION_LNG, SEOUL_CITY_HALL_LAT, SEOUL_CITY_HALL_LNG);

        assertThat(forward).isEqualTo(backward);
    }

    @Test
    void longitudeDegreesShrinkTowardThePoles() {
        double atEquator = GeoDistance.haversineMeters(0.0, 0.0, 0.0, 1.0);
        double atSeoulLatitude = GeoDistance.haversineMeters(37.5, 0.0, 37.5, 1.0);

        assertThat(atSeoulLatitude).isLessThan(atEquator);
        assertThat(atSeoulLatitude).isCloseTo(atEquator * Math.cos(Math.toRadians(37.5)), within(500.0));
    }

    @Test
    void handlesAntipodalPointsWithoutOverflowingTheArcsineDomain() {
        double meters = GeoDistance.haversineMeters(0.0, 0.0, 0.0, 180.0);

        assertThat(meters).isCloseTo(Math.PI * 6371008.8, within(1.0));
    }
}
