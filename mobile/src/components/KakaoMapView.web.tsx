import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DEFAULT_MAP_LEVEL } from '../config/constants';
import { getAppExtra } from '../config/env';
import type { LatLng } from '../types/geo';
import { buildKakaoMapHtml } from './kakaoMapHtml';
import { reverseGeocodeOnWeb, searchPlacesOnWeb } from './kakaoWebGeocoder';
import type {
  KakaoMapMessage,
  KakaoMapViewProps,
  MapFocusRequest,
  MarkerPayload,
} from './kakaoMapTypes';

export type { KakaoMapMessage, KakaoMapViewProps } from './kakaoMapTypes';

/** kakaoMapHtml.ts 가 iframe 안의 window 에 노출하는 함수들. */
type MirrorSpotApi = {
  setMarkers: (list: MarkerPayload[]) => void;
  setCenter: (latitude: number, longitude: number) => void;
  setSelected: (latitude: number | null, longitude: number | null) => void;
  setMyLocation: (latitude: number | null, longitude: number | null) => void;
  focusOn: (latitude: number, longitude: number, offsetY: number) => void;
};

/** iframe 이 부모 창으로 보내는 메시지 봉투(kakaoMapHtml.ts 의 send 와 짝). */
const MESSAGE_SOURCE = 'mirrorspot-map';

/**
 * react-native-webview 는 웹을 지원하지 않으므로, 웹에서는 같은 지도 HTML 을 iframe(srcDoc)으로 띄운다.
 * srcDoc iframe 은 부모와 같은 origin 이라 부모가 iframe 의 `window.MirrorSpot.*` 를 직접 호출할 수 있고,
 * iframe 은 `window.parent.postMessage` 로 결과를 돌려준다.
 *
 * 주의: 지도 SDK 는 부모 페이지 주소(예: http://localhost:8081)로 요청되므로, 카카오 콘솔의
 * [JavaScript SDK 도메인]에 그 주소가 등록되어 있어야 지도가 뜬다.
 * 주소 조회만은 iframe 안에서 하면 `about://` 로 거부되어, 이 페이지에서 따로 한다.
 */
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { kakaoJsKey } = getAppExtra();

  // 네이티브 구현과 동일하게, HTML 은 키/레벨이 바뀔 때만 다시 만들고 이동은 함수 호출로 처리한다.
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

  const getApi = useCallback((): MirrorSpotApi | undefined => {
    const frameWindow = iframeRef.current?.contentWindow as
      | (Window & { MirrorSpot?: MirrorSpotApi })
      | null
      | undefined;
    return frameWindow?.MirrorSpot;
  }, []);

  // SDK 로딩이 끝나기 전의 호출은 버려지므로, 최신 값을 들고 있다가 'ready' 때 다시 적용한다.
  const readyRef = useRef(false);
  const markersRef = useRef<MarkerPayload[]>(markerPayload);
  const centerRef = useRef<LatLng>(center);
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
    getApi()?.setMyLocation(next?.latitude ?? null, next?.longitude ?? null);
  }, [myLat, myLng, getApi]);

  const selectedLat = selectedPosition?.latitude;
  const selectedLng = selectedPosition?.longitude;
  useEffect(() => {
    const next =
      selectedLat === undefined || selectedLng === undefined
        ? null
        : { latitude: selectedLat, longitude: selectedLng };
    selectedRef.current = next;
    if (!readyRef.current) return;
    getApi()?.setSelected(next?.latitude ?? null, next?.longitude ?? null);
  }, [selectedLat, selectedLng, getApi]);

  useEffect(() => {
    centerRef.current = center;
    if (!readyRef.current) return;
    getApi()?.setCenter(center.latitude, center.longitude);
  }, [center, getApi]);

  useEffect(() => {
    markersRef.current = markerPayload;
    if (!readyRef.current) return;
    getApi()?.setMarkers(markerPayload);
  }, [markerPayload, getApi]);

  // 준비 전에 온 요청(예: 등록 직후 돌아왔는데 지도가 다시 로드되는 중)은 들고 있다가 'ready' 때 적용한다.
  const pendingFocusRef = useRef<MapFocusRequest | null>(null);
  useEffect(() => {
    if (!focusRequest) return;
    if (!readyRef.current) {
      pendingFocusRef.current = focusRequest;
      return;
    }
    pendingFocusRef.current = null;
    getApi()?.focusOn(focusRequest.latitude, focusRequest.longitude, focusRequest.offsetY);
  }, [focusRequest, getApi]);

  // 주소 조회는 iframe 이 아니라 이 페이지에서 한다(kakaoWebGeocoder.ts 주석 참고).
  // 지도 준비를 기다릴 필요도 없다.
  const onGeocodeResultRef = useRef(onGeocodeResult);
  onGeocodeResultRef.current = onGeocodeResult;
  useEffect(() => {
    if (!geocodeRequest || !kakaoJsKey) return;
    const { id, latitude, longitude } = geocodeRequest;
    void reverseGeocodeOnWeb(kakaoJsKey, latitude, longitude).then((payload) => {
      onGeocodeResultRef.current?.({
        id,
        roadAddress: payload.roadAddress ?? null,
        lotAddress: payload.lotAddress ?? null,
      });
    });
  }, [geocodeRequest, kakaoJsKey]);

  // 장소 검색도 주소 조회와 같은 이유로 이 페이지에서 한다.
  const onPlaceSearchResultRef = useRef(onPlaceSearchResult);
  onPlaceSearchResultRef.current = onPlaceSearchResult;
  useEffect(() => {
    if (!placeSearchRequest) return;
    const { id, query } = placeSearchRequest;
    if (!kakaoJsKey) {
      onPlaceSearchResultRef.current?.({ id, places: [], failed: true });
      return;
    }
    void searchPlacesOnWeb(kakaoJsKey, query).then((result) => {
      onPlaceSearchResultRef.current?.({ id, ...result });
    });
  }, [placeSearchRequest, kakaoJsKey]);

  const handleMessage = useCallback(
    (message: KakaoMapMessage) => {
      switch (message.type) {
        case 'ready': {
          readyRef.current = true;
          const api = getApi();
          api?.setCenter(centerRef.current.latitude, centerRef.current.longitude);
          api?.setMarkers(markersRef.current);
          api?.setSelected(
            selectedRef.current?.latitude ?? null,
            selectedRef.current?.longitude ?? null,
          );
          api?.setMyLocation(
            myLocationRef.current?.latitude ?? null,
            myLocationRef.current?.longitude ?? null,
          );
          // setCenter 다음에 적용해야 중심을 덮어쓰지 않는다.
          const pendingFocus = pendingFocusRef.current;
          if (pendingFocus) {
            api?.focusOn(pendingFocus.latitude, pendingFocus.longitude, pendingFocus.offsetY);
            pendingFocusRef.current = null;
          }
          break;
        }
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
        default:
          break;
      }
    },
    [getApi, onRegionChange, onMarkerPress, onMapPress, onUserDrag, onGeocodeResult],
  );

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      // 이 지도 iframe 이 보낸 메시지만 처리한다.
      if (event.source !== iframeRef.current?.contentWindow) return;
      const envelope = event.data as { source?: string; data?: unknown } | null;
      if (!envelope || envelope.source !== MESSAGE_SOURCE || typeof envelope.data !== 'string') {
        return;
      }
      try {
        handleMessage(JSON.parse(envelope.data) as KakaoMapMessage);
      } catch {
        // 형식이 다른 메시지는 무시한다.
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handleMessage]);

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
    <View style={styles.container}>
      <iframe
        ref={iframeRef}
        title="카카오 지도"
        srcDoc={html}
        style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f1f3',
    padding: 24,
  },
  placeholderText: { textAlign: 'center', color: '#555' },
});
