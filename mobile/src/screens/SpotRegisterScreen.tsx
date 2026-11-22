import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { confirmUpload, createSpot, uploadPhoto } from '../api/spots';
import { DEFAULT_MAP_LEVEL } from '../config/constants';
import { KakaoMapView } from '../components/KakaoMapView';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import type { RootScreenProps } from '../navigation/types';
import { registerSpot } from '../spots/registerSpot';
import { addOptimisticSpot, removeSpot, replaceSpot } from '../spots/spotsStore';
import type { LatLng } from '../types/geo';
import { formatCoordinateAddress } from '../utils/address';
import { PinDot, PlusIcon } from '../components/ui/Icons';
import { CONTENT_MAX_WIDTH, colors, radius, space, type } from '../theme';

type PickedPhoto = { uri: string; contentType: string };

export function SpotRegisterScreen({ navigation, route }: RootScreenProps<'SpotRegister'>) {
  const { center } = useCurrentLocation();
  const [position, setPosition] = useState<LatLng | null>(route.params?.initialCenter ?? null);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedPosition = position ?? center;
  const canSubmit = Boolean(photo) && name.trim().length > 0 && !submitting;

  const geocode = useReverseGeocode();
  const { requestAddress } = geocode;
  const { latitude, longitude } = resolvedPosition;

  useEffect(() => {
    requestAddress({ latitude, longitude });
  }, [requestAddress, latitude, longitude]);

  // Registration must never wait on the map WebView, so a lookup that is still
  // pending or that failed submits the raw coordinate instead.
  const submittedAddress = geocode.address ?? formatCoordinateAddress(resolvedPosition);

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('사진 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, contentType: asset.mimeType ?? 'image/jpeg' });
    setError(null);
  };

  const handleSubmit = async () => {
    if (!photo) {
      setError('사진을 1장 첨부해야 등록할 수 있습니다.');
      return;
    }
    if (!name.trim()) {
      setError('스팟 이름을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await registerSpot(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          address: submittedAddress,
          latitude: resolvedPosition.latitude,
          longitude: resolvedPosition.longitude,
          contentType: photo.contentType,
          photoUri: photo.uri,
        },
        {
          createSpot,
          uploadPhoto,
          confirmUpload,
          addOptimisticSpot,
          removeSpot,
          replaceSpot,
        },
      );
      navigation.navigate('Map');
    } catch {
      setError('스팟 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.column}>
        <View style={styles.section}>
          <Text style={type.heading}>위치</Text>
          <View style={styles.mapBox}>
            <KakaoMapView
              center={resolvedPosition}
              level={DEFAULT_MAP_LEVEL}
              onMapPress={setPosition}
              selectedPosition={resolvedPosition}
              geocodeRequest={geocode.request}
              onGeocodeResult={geocode.handleResult}
            />
          </View>
          <View style={styles.addressRow}>
            <PinDot />
            <Text testID="resolved-address" style={[type.label, styles.addressText]}>
              {geocode.status === 'pending' ? '주소 확인 중...' : submittedAddress}
            </Text>
          </View>
          <View style={styles.locationFooter}>
            <Text style={[type.caption, styles.flex]}>
              지도를 눌러 거울이 있는 곳을 정확히 찍어 주세요.
            </Text>
            <Pressable
              testID="use-current-location"
              accessibilityRole="button"
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              onPress={() => setPosition(center)}
            >
              <Text style={styles.chipText}>현재 위치 사용</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={type.heading}>사진</Text>
          {photo ? (
            <View>
              <Image testID="picked-photo" source={{ uri: photo.uri }} style={styles.preview} />
              <Pressable
                testID="pick-photo-button"
                accessibilityRole="button"
                style={({ pressed }) => [styles.changePhoto, pressed && styles.pressed]}
                onPress={() => void handlePickPhoto()}
              >
                <Text style={styles.changePhotoText}>사진 변경</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              testID="pick-photo-button"
              accessibilityRole="button"
              style={({ pressed }) => [styles.photoTile, pressed && styles.pressed]}
              onPress={() => void handlePickPhoto()}
            >
              <View style={styles.photoTileIcon}>
                <PlusIcon size={16} color={colors.accent} />
              </View>
              <Text style={type.label}>사진 선택</Text>
              <Text style={type.caption}>거울과 주변이 함께 보이는 사진 1장</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <Text style={type.heading}>스팟 이름</Text>
          <TextInput
            testID="spot-name-input"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="예: 성수동 카페 전신거울"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={styles.section}>
          <Text style={type.heading}>
            설명 <Text style={type.caption}>선택</Text>
          </Text>
          <TextInput
            testID="spot-description-input"
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="조명, 찍기 좋은 시간, 촬영 팁"
            placeholderTextColor={colors.muted}
            multiline
          />
        </View>

        {error ? (
          <Text testID="register-error" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Pressable
          testID="submit-spot-button"
          accessibilityRole="button"
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && styles.pressed,
          ]}
          onPress={() => void handleSubmit()}
        >
          {submitting ? (
            <ActivityIndicator color={colors.paper} />
          ) : (
            <Text style={styles.submitButtonText}>등록하기</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: 48 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', gap: space.xxl },
  section: { gap: space.md },
  flex: { flex: 1 },
  mapBox: { height: 240, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  addressText: { flex: 1 },
  locationFooter: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  chipText: { ...type.label, fontSize: 14, color: colors.accent },
  photoTile: {
    height: 168,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  photoTileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  // 상세 화면과 같은 3:4(세로형 4:3) 비율로 미리 보여준다.
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.lg, backgroundColor: colors.surface },
  changePhoto: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    backgroundColor: colors.scrim,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  changePhotoText: { ...type.label, fontSize: 14, color: colors.paper },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.ink,
  },
  multiline: { height: 110, textAlignVertical: 'top' },
  error: { ...type.body, color: colors.danger },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { backgroundColor: colors.line },
  submitButtonText: { ...type.label, fontSize: 16, color: colors.paper },
  pressed: { opacity: 0.75 },
});
