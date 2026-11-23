import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { fetchNearbySpots } from '../api/spots';
import { KakaoMapView } from '../components/KakaoMapView';
import type { MapFocusRequest } from '../components/kakaoMapTypes';
import { PEEK_RATIO, SpotPreviewSheet } from '../components/SpotPreviewSheet';
import { PlusIcon } from '../components/ui/Icons';
import { DEFAULT_SEARCH_RADIUS_M, DEFAULT_MAP_LEVEL } from '../config/constants';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useDebouncedRegion } from '../hooks/useDebouncedRegion';
import { useInsets } from '../hooks/useInsets';
import { usePlaceSearch } from '../hooks/usePlaceSearch';
import { PlaceSearchBar } from '../components/PlaceSearchBar';
import type { LatLng } from '../types/geo';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { displayableAddress } from '../utils/address';
import type { RootScreenProps } from '../navigation/types';
import { setSpots, useSpots } from '../spots/spotsStore';
import { colors, floating, radius, space, type } from '../theme';
import type { Spot } from '../types/spot';
import { formatDistance, haversineMeters } from '../utils/distance';

/** 화면 위쪽에 떠 있는 제목 바가 차지하는 높이(여백 12 + 바 52). */
const TITLE_BAR_OFFSET = 64;

export function MapScreen({ navigation, route }: RootScreenProps<'Map'>) {
  const { center, usingFallback, permission, requestPermission } = useCurrentLocation();
  const spots = useSpots();
  const insets = useInsets();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Spot | null>(null);
  // 상세 화면에서 돌아오면 시트를 다시 절반 높이로 올려 놓는다(끌어 올린 채로 남지 않게).
  const [sheetKey, setSheetKey] = useState(0);

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
        if (!cancelled) setError('주변 스팟을 불러오지 못했어요. 지도를 움직이면 다시 시도합니다.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settledRegion]);

  useEffect(
    () => navigation.addListener('focus', () => setSheetKey((key) => key + 1)),
    [navigation],
  );

  const { height: windowHeight } = useWindowDimensions();
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(null);
  const focusId = useRef(0);

  const handleMarkerPress = useCallback(
    (spotId: number) => {
      const spot = spots.find((item) => item.id === spotId);
      if (!spot) return;
      setSelected(spot);

      // 위쪽 제목 바와 아래쪽 시트 사이, 실제로 보이는 지도 영역의 가운데로 마커를 옮긴다.
      const visibleTop = insets.top + TITLE_BAR_OFFSET;
      const visibleBottom = windowHeight * (1 - PEEK_RATIO);
      const offsetY = Math.max(0, windowHeight / 2 - (visibleTop + visibleBottom) / 2);
      focusId.current += 1;
      setFocusRequest({
        id: focusId.current,
        latitude: spot.latitude,
        longitude: spot.longitude,
        offsetY: Math.round(offsetY),
      });
    },
    [spots, insets.top, windowHeight],
  );

  // 시트를 닫고 지도를 이 좌표로 옮긴다. 지도가 멈추면 idle 메시지가 오고, 그 주변 스팟을 다시 불러온다.
  const moveTo = useCallback((position: LatLng) => {
    setSelected(null);
    focusId.current += 1;
    setFocusRequest({
      id: focusId.current,
      latitude: position.latitude,
      longitude: position.longitude,
      offsetY: 0,
    });
  }, []);

  // 스팟을 등록하고 돌아오면 등록한 위치로 옮긴다. 매번 새 객체로 오므로 같은 좌표도 다시 옮긴다.
  const focusParam = route.params?.focus;
  useEffect(() => {
    if (focusParam) moveTo(focusParam);
  }, [focusParam, moveTo]);

  const placeSearch = usePlaceSearch();

  const closeSheet = useCallback(() => setSelected(null), []);

  const openDetail = useCallback(() => {
    if (selected) navigation.navigate('SpotDetail', { spotId: selected.id });
  }, [navigation, selected]);

  // 위치를 못 잡아 기본 위치를 쓰는 동안에는 거리가 의미 없으므로 숨긴다.
  const distanceText =
    selected && !usingFallback
      ? formatDistance(
          haversineMeters(center, { latitude: selected.latitude, longitude: selected.longitude }),
        )
      : null;

  // 주소 없이 저장된 스팟은 시트를 열 때 지도의 카카오 SDK 로 도로명 주소를 조회한다.
  const geocode = useReverseGeocode();
  const { requestAddress } = geocode;
  const storedAddress = displayableAddress(selected?.address);
  const lookupId = selected && !storedAddress ? selected.id : null;
  const lookupLat = selected?.latitude;
  const lookupLng = selected?.longitude;
  useEffect(() => {
    if (lookupId === null || lookupLat === undefined || lookupLng === undefined) return;
    requestAddress({ latitude: lookupLat, longitude: lookupLng });
  }, [lookupId, lookupLat, lookupLng, requestAddress]);

  let addressText: string;
  if (storedAddress) addressText = storedAddress;
  else if (geocode.address) addressText = geocode.address;
  else if (geocode.status === 'pending' || geocode.status === 'idle') addressText = '주소 확인 중...';
  else addressText = '주소 정보 없음';

  const notice = error
    ? error
    : loaded && spots.length === 0
      ? '이 주변에는 아직 스팟이 없어요. 처음으로 등록해 보세요.'
      : null;

  return (
    <View style={styles.container}>
      <KakaoMapView
        center={center}
        markers={spots}
        onRegionChange={onRegionChange}
        onMarkerPress={handleMarkerPress}
        onMapPress={closeSheet}
        focusRequest={focusRequest}
        geocodeRequest={geocode.request}
        onGeocodeResult={geocode.handleResult}
        placeSearchRequest={placeSearch.request}
        onPlaceSearchResult={placeSearch.handleResult}
      />

      <View style={[styles.top, { top: insets.top + space.md }]} pointerEvents="box-none">
        <PlaceSearchBar
          search={placeSearch}
          onSelect={moveTo}
          placeholder="장소, 주소 검색 (예: 망원역)"
          inputBoxStyle={[styles.searchBox, floating]}
          trailing={
            <Text testID="nearby-count" style={styles.count}>
              주변 {spots.length}곳
            </Text>
          }
        />

        {permission === 'denied' ? (
          <View testID="location-permission-banner" style={[styles.banner, floating]}>
            <Text style={[type.body, styles.bannerText]}>
              위치 권한이 없어 서울시청 주변을 보여 주고 있어요.
            </Text>
            <Pressable
              testID="request-location-permission"
              accessibilityRole="button"
              style={({ pressed }) => [styles.bannerButton, pressed && styles.pressed]}
              onPress={() => void requestPermission()}
            >
              <Text style={styles.bannerButtonText}>위치 권한 허용</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {selected ? (
        <SpotPreviewSheet
          key={`${selected.id}-${sheetKey}`}
          spot={selected}
          distanceText={distanceText}
          addressText={addressText}
          onOpen={openDetail}
          onClose={closeSheet}
          bottomInset={insets.bottom}
        />
      ) : (
        <View
          style={[styles.bottom, { bottom: insets.bottom + space.xl }]}
          pointerEvents="box-none"
        >
          {notice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}
          <Pressable
            testID="add-spot-button"
            accessibilityRole="button"
            style={({ pressed }) => [styles.fab, floating, pressed && styles.pressed]}
            onPress={() =>
              navigation.navigate('SpotRegister', {
                initialCenter: usingFallback ? settledRegion : center,
              })
            }
          >
            <PlusIcon size={14} />
            <Text style={styles.fabText}>스팟 추가</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  top: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm },
  searchBox: { backgroundColor: colors.paper, minHeight: 52 },
  count: {
    ...type.caption,
    color: colors.accent,
    fontWeight: '700',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  banner: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  bannerText: { color: colors.ink },
  bannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  bannerButtonText: { ...type.label, fontSize: 14, color: colors.accent },
  bottom: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', gap: space.md },
  notice: {
    backgroundColor: colors.scrim,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  noticeText: { ...type.caption, color: colors.paper, textAlign: 'center' },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    height: 52,
  },
  fabText: { ...type.label, color: colors.paper },
  pressed: { opacity: 0.75 },
});
