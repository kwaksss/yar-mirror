import { useCallback, useEffect, useRef, useState } from 'react';
import { GEOCODE_TIMEOUT_MS } from '../config/constants';
import type { LatLng } from '../types/geo';
import { pickKakaoAddress, type KakaoAddressPayload } from '../utils/address';

export type ReverseGeocodeRequest = {
  id: number;
  latitude: number;
  longitude: number;
};

export type ReverseGeocodeResult = KakaoAddressPayload & { id: number };

export type ReverseGeocodeStatus = 'idle' | 'pending' | 'resolved' | 'failed';

export type ReverseGeocode = {
  /** Hand to KakaoMapView, which forwards it to the Kakao JS SDK in its WebView. */
  request: ReverseGeocodeRequest | null;
  status: ReverseGeocodeStatus;
  /** Null until a lookup succeeds; callers fall back to the raw coordinate. */
  address: string | null;
  requestAddress: (position: LatLng) => void;
  handleResult: (result: ReverseGeocodeResult) => void;
};

/**
 * Reverse geocoding rides the Kakao Maps JS SDK already loaded in the map
 * WebView, so it is a fire-and-forget message rather than a promise. Requests
 * carry an incrementing id: a reply for a superseded coordinate is dropped, and
 * a reply that never arrives expires so the caller is never left waiting.
 */
export function useReverseGeocode(timeoutMs: number = GEOCODE_TIMEOUT_MS): ReverseGeocode {
  const [request, setRequest] = useState<ReverseGeocodeRequest | null>(null);
  const [status, setStatus] = useState<ReverseGeocodeStatus>('idle');
  const [address, setAddress] = useState<string | null>(null);

  const nextIdRef = useRef(1);
  const currentIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => clearTimer, []);

  const requestAddress = useCallback(
    (position: LatLng) => {
      clearTimer();
      const id = nextIdRef.current++;
      currentIdRef.current = id;

      setRequest({ id, latitude: position.latitude, longitude: position.longitude });
      setStatus('pending');
      setAddress(null);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (currentIdRef.current !== id) return;
        setStatus('failed');
      }, timeoutMs);
    },
    [timeoutMs],
  );

  const handleResult = useCallback((result: ReverseGeocodeResult) => {
    if (result.id !== currentIdRef.current) return;
    clearTimer();

    const picked = pickKakaoAddress(result);
    setAddress(picked);
    setStatus(picked ? 'resolved' : 'failed');
  }, []);

  return { request, status, address, requestAddress, handleResult };
}
