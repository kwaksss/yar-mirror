import type { LatLng } from '../types/geo';

/** 위치 권한 거부/실패 시 사용하는 기본 중심 좌표 (서울시청). */
export const FALLBACK_CENTER: LatLng = {
  latitude: 37.5665,
  longitude: 126.978,
};

export const DEFAULT_MAP_LEVEL = 5;
export const DEFAULT_SEARCH_RADIUS_M = 2000;
export const REGION_DEBOUNCE_MS = 500;
export const LOCATION_TIMEOUT_MS = 5000;
/** 실시간 내 위치를 이만큼(m) 움직일 때마다 갱신한다. */
export const LOCATION_WATCH_DISTANCE_M = 5;
export const GEOCODE_TIMEOUT_MS = 5000;
