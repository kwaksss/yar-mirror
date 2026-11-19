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
  /** Coordinate to reverse-geocode through the already-loaded Kakao JS SDK. */
  geocodeRequest?: ReverseGeocodeRequest | null;
  onGeocodeResult?: (result: ReverseGeocodeResult) => void;
};

export type MarkerPayload = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};
