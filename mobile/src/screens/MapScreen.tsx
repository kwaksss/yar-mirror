import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchNearbySpots } from '../api/spots';
import { KakaoMapView } from '../components/KakaoMapView';
import { DEFAULT_SEARCH_RADIUS_M, DEFAULT_MAP_LEVEL } from '../config/constants';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useDebouncedRegion } from '../hooks/useDebouncedRegion';
import type { RootScreenProps } from '../navigation/types';
import { setSpots, useSpots } from '../spots/spotsStore';

export function MapScreen({ navigation }: RootScreenProps<'Map'>) {
  const { center, usingFallback, permission, requestPermission } = useCurrentLocation();
  const spots = useSpots();
  const [error, setError] = useState<string | null>(null);

  const { region, settledRegion, onRegionChange } = useDebouncedRegion({
    ...center,
    level: DEFAULT_MAP_LEVEL,
    radius: DEFAULT_SEARCH_RADIUS_M,
  });

  // The location fix usually lands after the first render; recentring the map
  // also has to move the query origin, not just the WebView camera.
  useEffect(() => {
    onRegionChange({
      latitude: center.latitude,
      longitude: center.longitude,
      level: region.level,
      radius: region.radius,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.latitude, center.longitude, onRegionChange]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchNearbySpots({
          latitude: settledRegion.latitude,
          longitude: settledRegion.longitude,
          radius: settledRegion.radius || DEFAULT_SEARCH_RADIUS_M,
        });
        if (cancelled) return;
        setSpots(result);
        setError(null);
      } catch {
        if (!cancelled) setError('주변 스팟을 불러오지 못했습니다.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settledRegion]);

  const handleMarkerPress = useCallback(
    (spotId: number) => navigation.navigate('SpotDetail', { spotId }),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <KakaoMapView
        center={center}
        markers={spots}
        onRegionChange={onRegionChange}
        onMarkerPress={handleMarkerPress}
      />

      {permission === 'denied' ? (
        <View testID="location-permission-banner" style={styles.banner}>
          <Text style={styles.bannerText}>
            위치 권한이 없어 기본 위치(서울시청)를 표시하고 있습니다.
          </Text>
          <Pressable
            testID="request-location-permission"
            accessibilityRole="button"
            style={styles.bannerButton}
            onPress={() => void requestPermission()}
          >
            <Text style={styles.bannerButtonText}>권한 다시 요청</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorToast}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {spots.length === 0 && !error ? (
        <View style={styles.errorToast}>
          <Text style={styles.errorText}>이 주변에는 아직 등록된 스팟이 없습니다.</Text>
        </View>
      ) : null}

      <Pressable
        testID="add-spot-button"
        accessibilityRole="button"
        style={styles.fab}
        onPress={() =>
          navigation.navigate('SpotRegister', {
            initialCenter: usingFallback ? settledRegion : center,
          })
        }
      >
        <Text style={styles.fabText}>+ 스팟 추가</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  bannerText: { color: '#fff', fontSize: 13 },
  bannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bannerButtonText: { fontSize: 13, fontWeight: '600' },
  errorToast: {
    position: 'absolute',
    bottom: 92,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 10,
  },
  errorText: { color: '#fff', fontSize: 13, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    backgroundColor: '#111',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
