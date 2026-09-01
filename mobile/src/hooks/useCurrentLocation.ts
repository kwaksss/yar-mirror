import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { FALLBACK_CENTER, LOCATION_TIMEOUT_MS } from '../config/constants';
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
};

export function useCurrentLocation(): CurrentLocation {
  const [center, setCenter] = useState<LatLng>(FALLBACK_CENTER);
  const [usingFallback, setUsingFallback] = useState(true);
  const [permission, setPermission] = useState<LocationPermissionState>('checking');

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
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        LOCATION_TIMEOUT_MS,
      );
      setCenter({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setUsingFallback(false);
    } catch {
      // Permission may be granted but the fix failed — still fall back to the
      // default center so the map is usable.
      setPermission('denied');
      setCenter(FALLBACK_CENTER);
      setUsingFallback(true);
    }
  }, []);

  useEffect(() => {
    void requestPermission();
  }, [requestPermission]);

  return { center, usingFallback, permission, requestPermission };
}
