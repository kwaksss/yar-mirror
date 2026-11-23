import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  FALLBACK_CENTER,
  LOCATION_TIMEOUT_MS,
  LOCATION_WATCH_DISTANCE_M,
} from '../config/constants';
import type { LatLng } from '../types/geo';

/**
 * expo-location has no timeout option, and a device that never gets a fix would
 * otherwise leave the map stuck on the fallback with no permission banner.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, rejectTimeout) => {
    timer = setTimeout(() => rejectTimeout(new Error('location request timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export type LocationPermissionState = 'checking' | 'granted' | 'denied';

export type CurrentLocation = {
  center: LatLng;
  /** True while `center` is the fallback rather than a real fix. */
  usingFallback: boolean;
  permission: LocationPermissionState;
  requestPermission: () => Promise<void>;
  /**
   * 실시간 내 위치. watch 옵션을 켰을 때만 갱신된다. 위치를 아직 못 받았으면 null.
   * center 는 첫 위치만 담는다. 지도는 center 가 바뀔 때마다 그 위치로 옮겨지므로,
   * 실시간 값을 center 에 넣으면 사용자가 지도를 움직여도 계속 끌려간다.
   */
  myPosition: LatLng | null;
};

export type CurrentLocationOptions = {
  /** true 면 권한을 얻은 뒤 위치 변화를 구독한다. 화면을 떠나면 구독을 끊는다. */
  watch?: boolean;
};

// 걸으며 움직이는 점을 보여 주려면 GPS 가 필요하다. Balanced 는 iOS 에서 약 100m 정밀도라 50m 이동도 놓친다.
// 웹에서는 expo-location 이 옵션을 navigator.geolocation 에 그대로 넘기고 accuracy 는 무시되므로,
// enableHighAccuracy 를 직접 켜야 Safari 가 Wi-Fi 추정 대신 GPS 를 쓴다.
const WATCH_OPTIONS = {
  accuracy: Location.Accuracy.High,
  distanceInterval: LOCATION_WATCH_DISTANCE_M,
  ...(Platform.OS === 'web' ? { enableHighAccuracy: true } : {}),
} as Location.LocationOptions;

export function useCurrentLocation({ watch = false }: CurrentLocationOptions = {}): CurrentLocation {
  const [center, setCenter] = useState<LatLng>(FALLBACK_CENTER);
  const [usingFallback, setUsingFallback] = useState(true);
  const [permission, setPermission] = useState<LocationPermissionState>('checking');
  const [myPosition, setMyPosition] = useState<LatLng | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const unmountedRef = useRef(false);

  const startWatching = useCallback(async () => {
    if (!watch || subscriptionRef.current) return;
    try {
      const subscription = await Location.watchPositionAsync(
        WATCH_OPTIONS,
        (position) =>
          setMyPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
      );
      // 구독이 시작되기 전에 화면을 떠났으면 바로 끊는다.
      if (unmountedRef.current) subscription.remove();
      else subscriptionRef.current = subscription;
    } catch {
      // 구독에 실패해도 첫 위치와 지도는 그대로 쓸 수 있다.
    }
  }, [watch]);

  useEffect(() => {
    // 개발 모드(StrictMode)는 effect 를 정리했다가 다시 실행하므로 여기서 되돌린다.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  const requestPermission = useCallback(async () => {
    setPermission('checking');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        setPermission('denied');
        setCenter(FALLBACK_CENTER);
        setUsingFallback(true);
        return;
      }

      setPermission('granted');
      void startWatching();
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        LOCATION_TIMEOUT_MS,
      );
      const fix = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setCenter(fix);
      setUsingFallback(false);
      if (watch) setMyPosition((current) => current ?? fix);
    } catch {
      // Permission may be granted but the fix failed — still fall back to the
      // default center so the map is usable.
      setPermission('denied');
      setCenter(FALLBACK_CENTER);
      setUsingFallback(true);
    }
  }, [startWatching, watch]);

  useEffect(() => {
    void requestPermission();
  }, [requestPermission]);

  return { center, usingFallback, permission, requestPermission, myPosition };
}
