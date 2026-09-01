import type { LatLng } from '../types/geo';

const EARTH_RADIUS_M = 6371000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineMeters(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * "320m" under 1km, "1.2km" at or above it. Rounding happens before the unit
 * choice so 999.6m reads as "1.0km" rather than "1000m".
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return '거리 정보 없음';

  const roundedMeters = Math.round(meters);
  if (roundedMeters < 1000) return `${roundedMeters}m`;

  return `${(meters / 1000).toFixed(1)}km`;
}
