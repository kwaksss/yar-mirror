import { useCallback, useEffect, useRef, useState } from 'react';
import { REGION_DEBOUNCE_MS } from '../config/constants';
import type { MapRegion } from '../types/geo';

export type DebouncedRegion = {
  /** Latest region reported by the map, updated on every idle event. */
  region: MapRegion;
  /** Region that has stayed put for `delayMs` — the one worth refetching for. */
  settledRegion: MapRegion;
  onRegionChange: (next: MapRegion) => void;
};

export function useDebouncedRegion(
  initialRegion: MapRegion,
  delayMs: number = REGION_DEBOUNCE_MS,
): DebouncedRegion {
  const [region, setRegion] = useState<MapRegion>(initialRegion);
  const [settledRegion, setSettledRegion] = useState<MapRegion>(initialRegion);
  const pendingRef = useRef<MapRegion>(initialRegion);

  const onRegionChange = useCallback((next: MapRegion) => {
    pendingRef.current = next;
    setRegion(next);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettledRegion(pendingRef.current);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [region, delayMs]);

  return { region, settledRegion, onRegionChange };
}
