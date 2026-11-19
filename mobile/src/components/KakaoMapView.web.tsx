import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DEFAULT_MAP_LEVEL } from '../config/constants';
import { getAppExtra } from '../config/env';
import type { ReverseGeocodeRequest } from '../hooks/useReverseGeocode';
import type { LatLng } from '../types/geo';
import { buildKakaoMapHtml } from './kakaoMapHtml';
import type { KakaoMapMessage, KakaoMapViewProps, MarkerPayload } from './kakaoMapTypes';

export type { KakaoMapMessage, KakaoMapViewProps } from './kakaoMapTypes';

/** kakaoMapHtml.ts 가 iframe 안의 window 에 노출하는 함수들. */
type MirrorSpotApi = {
  setMarkers: (list: MarkerPayload[]) => void;
  setCenter: (latitude: number, longitude: number) => void;
  reverseGeocode: (id: number, latitude: number, longitude: number) => void;
};

/** iframe 이 부모 창으로 보내는 메시지 봉투(kakaoMapHtml.ts 의 send 와 짝). */
const MESSAGE_SOURCE = 'mirrorspot-map';

/**
 * react-native-webview 는 웹을 지원하지 않으므로, 웹에서는 같은 지도 HTML 을 iframe(srcDoc)으로 띄운다.
 * srcDoc iframe 은 부모와 같은 origin 이라 부모가 iframe 의 `window.MirrorSpot.*` 를 직접 호출할 수 있고,
 * iframe 은 `window.parent.postMessage` 로 결과를 돌려준다.
 *
 * 주의: 이 iframe 의 origin 은 앱의 웹 주소(예: http://localhost:8081)이므로, 카카오 콘솔의
 * [JavaScript SDK 도메인]에 그 주소가 등록되어 있어야 지도가 뜬다.
 */
export function KakaoMapView({
  center,
  markers = [],
  level = DEFAULT_MAP_LEVEL,
  onRegionChange,
  onMarkerPress,
  onMapPress,
  geocodeRequest = null,
  onGeocodeResult,
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
  const geocodeRef = useRef<ReverseGeocodeRequest | null>(geocodeRequest);

  useEffect(() => {
    readyRef.current = false;
  }, [html]);

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

  useEffect(() => {
    geocodeRef.current = geocodeRequest;
    if (!geocodeRequest || !readyRef.current) return;
    getApi()?.reverseGeocode(geocodeRequest.id, geocodeRequest.latitude, geocodeRequest.longitude);
  }, [geocodeRequest, getApi]);

  const handleMessage = useCallback(
    (message: KakaoMapMessage) => {
      switch (message.type) {
        case 'ready': {
          readyRef.current = true;
          const api = getApi();
          api?.setCenter(centerRef.current.latitude, centerRef.current.longitude);
          api?.setMarkers(markersRef.current);
          if (geocodeRef.current) {
            api?.reverseGeocode(
              geocodeRef.current.id,
              geocodeRef.current.latitude,
              geocodeRef.current.longitude,
            );
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
    [getApi, onRegionChange, onMarkerPress, onMapPress, onGeocodeResult],
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
