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
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.label}>위치</Text>
      <View style={styles.mapBox}>
        <KakaoMapView
          center={resolvedPosition}
          level={DEFAULT_MAP_LEVEL}
          onMapPress={setPosition}
          geocodeRequest={geocode.request}
          onGeocodeResult={geocode.handleResult}
        />
      </View>
      <Text style={styles.hint}>
        지도를 탭해 위치를 지정하거나 현재 위치를 사용하세요.{'\n'}
        선택 위치: {resolvedPosition.latitude.toFixed(5)},{' '}
        {resolvedPosition.longitude.toFixed(5)}
      </Text>
      <Text testID="resolved-address" style={styles.hint}>
        주소: {geocode.status === 'pending' ? '확인 중...' : submittedAddress}
      </Text>
      <Pressable
        testID="use-current-location"
        accessibilityRole="button"
        style={styles.secondaryButton}
        onPress={() => setPosition(center)}
      >
        <Text style={styles.secondaryButtonText}>현재 위치 사용</Text>
      </Pressable>

      <Text style={styles.label}>사진 (1장 필수)</Text>
      <Pressable
        testID="pick-photo-button"
        accessibilityRole="button"
        style={styles.secondaryButton}
        onPress={() => void handlePickPhoto()}
      >
        <Text style={styles.secondaryButtonText}>
          {photo ? '사진 변경' : '사진 선택'}
        </Text>
      </Pressable>
      {photo ? (
        <Image testID="picked-photo" source={{ uri: photo.uri }} style={styles.preview} />
      ) : null}

      <Text style={styles.label}>스팟 이름 (필수)</Text>
      <TextInput
        testID="spot-name-input"
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="예: 성수동 카페 전신거울"
      />

      <Text style={styles.label}>설명 (선택)</Text>
      <TextInput
        testID="spot-description-input"
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="조명, 촬영 팁 등"
        multiline
      />

      {error ? (
        <Text testID="register-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="submit-spot-button"
        accessibilityRole="button"
        disabled={!canSubmit}
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={() => void handleSubmit()}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>등록하기</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  hint: { fontSize: 13, color: '#666' },
  mapBox: { height: 220, borderRadius: 10, overflow: 'hidden' },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  preview: { width: '100%', height: 220, borderRadius: 10, backgroundColor: '#eee' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { height: 90, textAlignVertical: 'top' },
  error: { color: '#c0392b', fontSize: 14 },
  submitButton: {
    marginTop: 12,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonDisabled: { backgroundColor: '#bbb' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
