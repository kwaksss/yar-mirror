import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchSpotDetail } from '../api/spots';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import type { RootScreenProps } from '../navigation/types';
import type { SpotDetail } from '../types/spot';
import { formatDistance, haversineMeters } from '../utils/distance';

export function SpotDetailScreen({ route }: RootScreenProps<'SpotDetail'>) {
  const { spotId } = route.params;
  const { center } = useCurrentLocation();
  const [spot, setSpot] = useState<SpotDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchSpotDetail(spotId, {
          latitude: center.latitude,
          longitude: center.longitude,
        });
        if (!cancelled) setSpot(result);
      } catch {
        if (!cancelled) setError('스팟 정보를 불러오지 못했습니다.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spotId, center.latitude, center.longitude]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text testID="spot-detail-error">{error}</Text>
      </View>
    );
  }

  if (!spot) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const distanceMeters =
    spot.distanceMeters ??
    haversineMeters(center, { latitude: spot.latitude, longitude: spot.longitude });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {spot.photoUrl ? (
        <Image testID="spot-photo" source={{ uri: spot.photoUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.muted}>사진 없음</Text>
        </View>
      )}

      <Text style={styles.name}>{spot.name}</Text>
      <Text testID="spot-address" style={styles.address}>
        {spot.address ?? '주소 정보 없음'}
      </Text>
      <Text testID="spot-distance" style={styles.distance}>
        현재 위치에서 {formatDistance(distanceMeters)}
      </Text>

      {spot.description ? <Text style={styles.description}>{spot.description}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 8 },
  photo: { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#eee' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#888' },
  name: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  address: { fontSize: 15, color: '#444' },
  distance: { fontSize: 15, fontWeight: '600', color: '#0a6' },
  description: { fontSize: 15, color: '#333', marginTop: 8, lineHeight: 22 },
});
