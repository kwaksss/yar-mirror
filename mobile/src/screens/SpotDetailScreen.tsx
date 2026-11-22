import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchSpotDetail } from '../api/spots';
import { PinDot } from '../components/ui/Icons';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useInsets } from '../hooks/useInsets';
import { FloatingBackButton } from '../navigation/HeaderBackButton';
import type { RootScreenProps } from '../navigation/types';
import { CONTENT_MAX_WIDTH, colors, radius, space, type } from '../theme';
import type { SpotDetail } from '../types/spot';
import { formatDistance, haversineMeters } from '../utils/distance';

function formatRegisteredDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 등록`;
}

export function SpotDetailScreen({ navigation, route }: RootScreenProps<'SpotDetail'>) {
  const { spotId } = route.params;
  const { center } = useCurrentLocation();
  const insets = useInsets();
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
        if (!cancelled) setError('스팟 정보를 불러오지 못했어요. 잠시 후 다시 열어 주세요.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spotId, center.latitude, center.longitude]);

  const backButton = (
    <FloatingBackButton
      navigation={navigation}
      style={[styles.back, { top: insets.top + space.md }]}
    />
  );

  if (error || !spot) {
    return (
      <View style={styles.centered}>
        {error ? (
          <Text testID="spot-detail-error" style={[type.body, styles.errorText]}>
            {error}
          </Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
        {backButton}
      </View>
    );
  }

  const distanceMeters =
    spot.distanceMeters ??
    haversineMeters(center, { latitude: spot.latitude, longitude: spot.longitude });
  const registered = formatRegisteredDate(spot.createdAt);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.column}>
          {spot.photoUrl ? (
            <Image
              testID="spot-photo"
              source={{ uri: spot.photoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={type.caption}>아직 사진이 없어요</Text>
            </View>
          )}

          <View style={styles.sheet}>
            <Text style={type.display}>{spot.name}</Text>

            <View style={styles.addressRow}>
              <PinDot />
              <Text testID="spot-address" style={[type.body, styles.address]}>
                {spot.address ?? '주소 정보 없음'}
              </Text>
            </View>

            <View style={styles.distanceChip}>
              <Text testID="spot-distance" style={styles.distanceText}>
                현재 위치에서 {formatDistance(distanceMeters)}
              </Text>
            </View>

            {spot.description ? (
              <Text style={[type.body, styles.description]}>{spot.description}</Text>
            ) : null}

            {registered ? <Text style={[type.caption, styles.registered]}>{registered}</Text> : null}
          </View>
        </View>
      </ScrollView>
      {backButton}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    padding: space.xxl,
  },
  errorText: { textAlign: 'center' },
  back: { position: 'absolute', left: space.lg },
  scroll: { flexGrow: 1 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  // 거울샷은 세로 사진이 대부분이라 3:4(세로형 4:3) 비율로 고정한다.
  photo: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surface },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  // 사진 아래쪽에 살짝 겹쳐 올라오는 본문 — 지도 미리보기 시트가 그대로 펼쳐진 모양을 잇는다.
  sheet: {
    marginTop: -radius.sheet,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    gap: space.md,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  address: { flex: 1 },
  distanceChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  distanceText: { ...type.caption, fontWeight: '700', color: colors.accent },
  description: {
    marginTop: space.sm,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    color: colors.ink,
    lineHeight: 24,
  },
  registered: { marginTop: space.sm },
});
