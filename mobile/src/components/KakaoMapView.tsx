import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { DEFAULT_MAP_LEVEL } from '../config/constants';
import { getAppExtra } from '../config/env';
import type { PlaceSearchRequest } from '../hooks/usePlaceSearch';
import type { ReverseGeocodeRequest } from '../hooks/useReverseGeocode';
import type { LatLng } from '../types/geo';
import { buildKakaoMapHtml } from './kakaoMapHtml';
import type {
  KakaoMapMessage,
  KakaoMapViewProps,
  MapFocusRequest,
  MarkerPayload,
} from './kakaoMapTypes';

// 웹 빌드는 KakaoMapView.web.tsx 를 쓰므로, 타입은 두 구현이 공유하는 파일에서 가져와 다시 내보낸다.
export type { KakaoMapMessage, KakaoMapViewProps } from './kakaoMapTypes';

const setMarkersScript = (payload: MarkerPayload[]) =>
  `window.MirrorSpot && window.MirrorSpot.setMarkers(${JSON.stringify(payload)}); true;`;

const setCenterScript = (center: LatLng) =>
  `window.MirrorSpot && window.MirrorSpot.setCenter(${center.latitude}, ${center.longitude}); true;`;

const setSelectedScript = (position: LatLng | null) =>
  position
    ? `window.MirrorSpot && window.MirrorSpot.setSelected(${position.latitude}, ${position.longitude}); true;`
    : `window.MirrorSpot && window.MirrorSpot.setSelected(null, null); true;`;

const setMyLocationScript = (position: LatLng | null) =>
  position
    ? `window.MirrorSpot && window.MirrorSpot.setMyLocation(${position.latitude}, ${position.longitude}); true;`
    : `window.MirrorSpot && window.MirrorSpot.setMyLocation(null, null); true;`;

const focusScript = (request: MapFocusRequest) =>
  `window.MirrorSpot && window.MirrorSpot.focusOn(${request.latitude}, ${request.longitude}, ${request.offsetY}); true;`;

// 검색어는 사용자가 입력한 문자열이라 JSON.stringify 로 감싸 스크립트에 넣는다.
const searchPlacesScript = (request: PlaceSearchRequest) =>
  `window.MirrorSpot && window.MirrorSpot.searchPlaces(${request.id}, ${JSON.stringify(request.query)}); true;`;

const reverseGeocodeScript = (request: ReverseGeocodeRequest) =>
  `window.MirrorSpot && window.MirrorSpot.reverseGeocode(${request.id}, ${request.latitude}, ${request.longitude}); true;`;

export function KakaoMapView({
  center,
  markers = [],
  level = DEFAULT_MAP_LEVEL,
  onRegionChange,
  onMarkerPress,
  onMapPress,
  myLocation = null,
  onUserDrag,
  selectedPosition = null,
  focusRequest = null,
  geocodeRequest = null,
  onGeocodeResult,
  placeSearchRequest = null,
  onPlaceSearchResult,
}: KakaoMapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const { kakaoJsKey } = getAppExtra();

  // The HTML is built once per key/level so remounting does not reset the map
  // on every recentring; recentring goes through injectJavaScript instead.
  const html = useMemo(
    () => buildKakaoMapHtml({ jsKey: kakaoJsKey, center, level }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kakaoJsKey, level],
  );

  const markerPayload = useMemo<MarkerPayload[]>(
    () =>
      markers.map((spot) => ({
        id: spot.id,
        name: spot.name,
        latitude: spot.latitude,
        longitude: spot.longitude,
      })),
    [markers],
  );

  // Injections before the Kakao SDK finishes loading hit an undefined
  // window.MirrorSpot and are silently dropped, so the latest center and marker
  // set are held here and replayed when the WebView reports 'ready'.
  const readyRef = useRef(false);
  const markersRef = useRef<MarkerPayload[]>(markerPayload);
  const centerRef = useRef<LatLng>(center);
  const geocodeRef = useRef<ReverseGeocodeRequest | null>(geocodeRequest);
  const selectedRef = useRef<LatLng | null>(selectedPosition);

  useEffect(() => {
    readyRef.current = false;
  }, [html]);

  const myLocationRef = useRef<LatLng | null>(myLocation);
  const myLat = myLocation?.latitude;
  const myLng = myLocation?.longitude;
  useEffect(() => {
    const next =
      myLat === undefined || myLng === undefined ? null : { latitude: myLat, longitude: myLng };
    myLocationRef.current = next;
    if (!readyRef.current) return;
    webViewRef.current?.injectJavaScript(setMyLocationScript(next));
  }, [myLat, myLng]);

  const selectedLat = selectedPosition?.latitude;
  const selectedLng = selectedPosition?.longitude;
  useEffect(() => {
    const next =
      selectedLat === undefined || selectedLng === undefined
        ? null
        : { latitude: selectedLat, longitude: selectedLng };
    selectedRef.current = next;
    if (!readyRef.current) return;
    webViewRef.current?.injectJavaScript(setSelectedScript(next));
  }, [selectedLat, selectedLng]);

  useEffect(() => {
    centerRef.current = center;
    if (!readyRef.current) return;
    webViewRef.current?.injectJavaScript(setCenterScript(center));
  }, [center]);

  useEffect(() => {
    markersRef.current = markerPayload;
    if (!readyRef.current) return;
    webViewRef.current?.injectJavaScript(setMarkersScript(markerPayload));
  }, [markerPayload]);

  // 준비 전에 온 요청(예: 등록 직후 돌아왔는데 지도가 다시 로드되는 중)은 들고 있다가 'ready' 때 적용한다.
  const pendingFocusRef = useRef<MapFocusRequest | null>(null);
  useEffect(() => {
    if (!focusRequest) return;
    if (!readyRef.current) {
      pendingFocusRef.current = focusRequest;
      return;
    }
    pendingFocusRef.current = null;
    webViewRef.current?.injectJavaScript(focusScript(focusRequest));
  }, [focusRequest]);

  useEffect(() => {
    geocodeRef.current = geocodeRequest;
    if (!geocodeRequest || !readyRef.current) return;
    webViewRef.current?.injectJavaScript(reverseGeocodeScript(geocodeRequest));
  }, [geocodeRequest]);

  const placeSearchRef = useRef<PlaceSearchRequest | null>(placeSearchRequest);
  useEffect(() => {
    placeSearchRef.current = placeSearchRequest;
    if (!placeSearchRequest || !readyRef.current) return;
    webViewRef.current?.injectJavaScript(searchPlacesScript(placeSearchRequest));
  }, [placeSearchRequest]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let message: KakaoMapMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as KakaoMapMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case 'ready':
          readyRef.current = true;
          webViewRef.current?.injectJavaScript(setCenterScript(centerRef.current));
          webViewRef.current?.injectJavaScript(setMarkersScript(markersRef.current));
          webViewRef.current?.injectJavaScript(setSelectedScript(selectedRef.current));
          webViewRef.current?.injectJavaScript(setMyLocationScript(myLocationRef.current));
          if (geocodeRef.current) {
            webViewRef.current?.injectJavaScript(reverseGeocodeScript(geocodeRef.current));
          }
          if (placeSearchRef.current) {
            webViewRef.current?.injectJavaScript(searchPlacesScript(placeSearchRef.current));
          }
          // setCenter 다음에 적용해야 중심을 덮어쓰지 않는다.
          if (pendingFocusRef.current) {
            webViewRef.current?.injectJavaScript(focusScript(pendingFocusRef.current));
            pendingFocusRef.current = null;
          }
          break;
        case 'idle':
          onRegionChange?.({
            latitude: message.latitude,
            longitude: message.longitude,
            level: message.level,
            radius: message.radius,
          });
          break;
        case 'dragstart':
          onUserDrag?.();
          break;
        case 'markerPress':
          onMarkerPress?.(message.spotId);
          break;
        case 'mapPress':
          onMapPress?.({ latitude: message.latitude, longitude: message.longitude });
          break;
        case 'geocode':
          onGeocodeResult?.({
            id: message.id,
            roadAddress: message.roadAddress ?? null,
            lotAddress: message.lotAddress ?? null,
          });
          break;
        case 'places':
          onPlaceSearchResult?.({
            id: message.id,
            places: Array.isArray(message.places) ? message.places : [],
            failed: Boolean(message.failed),
          });
          break;
        default:
          break;
      }
    },
    [onRegionChange, onMarkerPress, onMapPress, onUserDrag, onGeocodeResult, onPlaceSearchResult],
  );

  if (!kakaoJsKey) {
    return (
      <View style={styles.placeholder} testID="kakao-map-missing-key">
        <Text style={styles.placeholderText}>
          카카오맵 JS 키가 설정되지 않았습니다.{'\n'}
          EXPO_PUBLIC_KAKAO_JS_KEY 를 설정해 주세요.
        </Text>
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      testID="kakao-map-webview"
      style={styles.webView}
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://localhost' }}
      javaScriptEnabled
      onMessage={handleMessage}
    />
  );
}

const styles = StyleSheet.create({
  webView: { flex: 1 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f1f3',
    padding: 24,
  },
  placeholderText: { textAlign: 'center', color: '#555' },
});
