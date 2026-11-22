import type {
  ReverseGeocodeRequest,
  ReverseGeocodeResult,
} from '../hooks/useReverseGeocode';
import type { LatLng, MapRegion } from '../types/geo';
import type { Spot } from '../types/spot';

/** 지도(WebView/iframe) 안의 Kakao SDK 가 앱으로 보내는 메시지. */
export type KakaoMapMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | ({ type: 'idle' } & MapRegion)
  | ({ type: 'mapPress' } & LatLng)
  | { type: 'markerPress'; spotId: number }
  | ({ type: 'geocode' } & ReverseGeocodeResult);

export type KakaoMapViewProps = {
  center: LatLng;
  markers?: Spot[];
  level?: number;
  onRegionChange?: (region: MapRegion) => void;
  onMarkerPress?: (spotId: number) => void;
  onMapPress?: (position: LatLng) => void;
  /** 사용자가 고른 위치에 표시할 단일 마커. null/생략이면 표시하지 않는다. */
  selectedPosition?: LatLng | null;
  /**
   * 지도를 이 좌표로 부드럽게 옮긴다. id 가 바뀔 때마다 한 번 실행된다(같은 마커를 다시 눌러도 이동).
   * offsetY 만큼 화면 가운데보다 위에 둔다.
   */
  focusRequest?: MapFocusRequest | null;
  /** Coordinate to reverse-geocode through the already-loaded Kakao JS SDK. */
  geocodeRequest?: ReverseGeocodeRequest | null;
  onGeocodeResult?: (result: ReverseGeocodeResult) => void;
};

export type MapFocusRequest = LatLng & {
  id: number;
  offsetY: number;
};

export type MarkerPayload = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};
