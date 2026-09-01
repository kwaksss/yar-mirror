export type LatLng = {
  latitude: number;
  longitude: number;
};

export type MapRegion = LatLng & {
  /** Kakao map zoom level (lower = closer). */
  level: number;
  /** Approximate visible radius in meters. */
  radius: number;
};
