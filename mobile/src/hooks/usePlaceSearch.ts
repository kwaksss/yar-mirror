import { useCallback, useEffect, useRef, useState } from 'react';
import { GEOCODE_TIMEOUT_MS } from '../config/constants';
import type { LatLng } from '../types/geo';

/** 카카오 장소 검색 결과 한 건. */
export type Place = LatLng & {
  name: string;
  address: string | null;
};

export type PlaceSearchRequest = {
  id: number;
  query: string;
};

/** failed: 검색 자체가 실패했다(네트워크, SDK 오류). 결과 0건은 failed 가 아니다. */
export type PlaceSearchResult = {
  id: number;
  places: Place[];
  failed: boolean;
};

export type PlaceSearchStatus = 'idle' | 'pending' | 'resolved' | 'failed';

export type PlaceSearch = {
  /** KakaoMapView 에 넘긴다. 지도 안의 카카오 SDK 가 검색한다. */
  request: PlaceSearchRequest | null;
  status: PlaceSearchStatus;
  places: Place[];
  search: (query: string) => void;
  clear: () => void;
  handleResult: (result: PlaceSearchResult) => void;
};

/**
 * 장소 검색도 주소 조회(useReverseGeocode)처럼 지도에 이미 올라간 카카오 SDK 로 보낸다.
 * 요청마다 id 를 붙여 이전 검색의 늦은 응답은 버리고, 응답이 오지 않으면 시간이 지나 실패로 둔다.
 */
export function usePlaceSearch(timeoutMs: number = GEOCODE_TIMEOUT_MS): PlaceSearch {
  const [request, setRequest] = useState<PlaceSearchRequest | null>(null);
  const [status, setStatus] = useState<PlaceSearchStatus>('idle');
  const [places, setPlaces] = useState<Place[]>([]);

  const nextIdRef = useRef(1);
  const currentIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => clearTimer, []);

  const search = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      clearTimer();
      const id = nextIdRef.current++;
      currentIdRef.current = id;

      setRequest({ id, query: trimmed });
      setStatus('pending');
      setPlaces([]);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (currentIdRef.current !== id) return;
        setStatus('failed');
      }, timeoutMs);
    },
    [timeoutMs],
  );

  const clear = useCallback(() => {
    clearTimer();
    currentIdRef.current = 0;
    setRequest(null);
    setStatus('idle');
    setPlaces([]);
  }, []);

  const handleResult = useCallback((result: PlaceSearchResult) => {
    if (result.id !== currentIdRef.current) return;
    clearTimer();
    setPlaces(result.places);
    setStatus(result.failed ? 'failed' : 'resolved');
  }, []);

  return { request, status, places, search, clear, handleResult };
}
