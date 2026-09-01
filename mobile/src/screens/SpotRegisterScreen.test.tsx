import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SpotRegisterScreen } from './SpotRegisterScreen';

const mockCreateSpot = jest.fn();
const mockUploadPhoto = jest.fn();
const mockConfirmUpload = jest.fn();

jest.mock('../api/spots', () => ({
  createSpot: (...args: unknown[]) => mockCreateSpot(...args),
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  confirmUpload: (...args: unknown[]) => mockConfirmUpload(...args),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///tmp/mirror.jpg', mimeType: 'image/jpeg' }],
  })),
}));

jest.mock('../hooks/useCurrentLocation', () => ({
  useCurrentLocation: () => ({
    center: { latitude: 37.5445, longitude: 127.0557 },
    usingFallback: false,
    permission: 'granted',
    requestPermission: jest.fn(),
  }),
}));

jest.mock('../config/env', () => ({
  getAppExtra: () => ({
    apiBaseUrl: 'http://localhost:8080',
    kakaoJsKey: 'test-js-key',
    kakaoRestApiKey: '',
    googleClientId: '',
  }),
}));

jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactModule = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    WebView: ReactModule.forwardRef((props: any, ref: any) => {
      ReactModule.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
      return ReactModule.createElement(View, {
        testID: props.testID,
        onMessage: props.onMessage,
      });
    }),
  };
});

const navigation = { navigate: jest.fn() };

const renderScreen = () =>
  render(
    <SpotRegisterScreen
      route={{ key: 'SpotRegister', name: 'SpotRegister', params: undefined } as never}
      navigation={navigation as never}
    />,
  );

/** Simulates the Kakao JS SDK inside the WebView answering the reverse-geocode call. */
const replyWithAddress = async (payload: unknown) => {
  await act(async () => {
    fireEvent(screen.getByTestId('kakao-map-webview'), 'message', {
      nativeEvent: { data: JSON.stringify(payload) },
    });
  });
};

const fillFormAndSubmit = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId('pick-photo-button'));
  });
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('spot-name-input'), '성수동 전신거울');
  });
  await act(async () => {
    fireEvent.press(screen.getByTestId('submit-spot-button'));
  });
};

describe('SpotRegisterScreen address auto-fill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSpot.mockResolvedValue({
      spotId: 42,
      photoUploadStatus: 'PENDING',
      photoUrl: 'http://localhost:8080/local-storage/spots/uuid.jpg',
      uploadUrl: 'http://localhost:8080/local-storage/spots/uuid.jpg',
      uploadMethod: 'PUT',
      uploadUrlExpiresAt: '2026-01-01T00:10:00Z',
    });
    mockUploadPhoto.mockResolvedValue(undefined);
    mockConfirmUpload.mockResolvedValue({ id: 42 });
  });

  it('submits the address the WebView reverse-geocoded for the picked coordinate', async () => {
    await renderScreen();

    await replyWithAddress({
      type: 'geocode',
      id: 1,
      roadAddress: '서울 성동구 성수이로 10',
      lotAddress: '서울 성동구 성수동2가 1-1',
    });

    expect(screen.getByTestId('resolved-address')).toHaveTextContent(/서울 성동구 성수이로 10/);

    await fillFormAndSubmit();

    await waitFor(() =>
      expect(mockCreateSpot).toHaveBeenCalledWith(
        expect.objectContaining({ address: '서울 성동구 성수이로 10' }),
      ),
    );
  });

  it('registers with the coordinate fallback when the lookup finds no address', async () => {
    await renderScreen();

    await replyWithAddress({ type: 'geocode', id: 1, roadAddress: null, lotAddress: null });
    await fillFormAndSubmit();

    await waitFor(() =>
      expect(mockCreateSpot).toHaveBeenCalledWith(
        expect.objectContaining({ address: '37.54450, 127.05570' }),
      ),
    );
    expect(navigation.navigate).toHaveBeenCalledWith('Map');
  });

  it('does not block registration while the lookup is still pending', async () => {
    await renderScreen();

    expect(screen.getByTestId('resolved-address')).toHaveTextContent(/확인 중/);

    await fillFormAndSubmit();

    await waitFor(() =>
      expect(mockCreateSpot).toHaveBeenCalledWith(
        expect.objectContaining({ address: '37.54450, 127.05570' }),
      ),
    );
    expect(navigation.navigate).toHaveBeenCalledWith('Map');
  });
});
