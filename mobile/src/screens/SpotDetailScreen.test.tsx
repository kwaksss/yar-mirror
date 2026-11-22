import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SpotDetailScreen } from './SpotDetailScreen';
import type { SpotDetail } from '../types/spot';

const mockFetchSpotDetail = jest.fn();
const mockInjectJavaScript = jest.fn();

jest.mock('../api/spots', () => ({
  fetchSpotDetail: (...args: unknown[]) => mockFetchSpotDetail(...args),
}));

jest.mock('../hooks/useCurrentLocation', () => ({
  useCurrentLocation: () => ({
    center: { latitude: 37.5665, longitude: 126.978 },
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
      ReactModule.useImperativeHandle(ref, () => ({ injectJavaScript: mockInjectJavaScript }));
      return ReactModule.createElement(View, { testID: props.testID, onMessage: props.onMessage });
    }),
  };
});

const detail: SpotDetail = {
  id: 42,
  name: '성수동 전신거울',
  address: '서울 성동구 성수이로 10',
  description: null,
  photoUrl: 'http://localhost:8080/local-storage/spots/uuid.jpg',
  photoUploadStatus: 'CONFIRMED',
  latitude: 37.5445,
  longitude: 127.0557,
  distanceMeters: 320,
  uploaderId: 7,
  createdAt: '2026-01-01T00:00:00Z',
};

const renderScreen = () =>
  render(
    <SpotDetailScreen
      route={{ key: 'SpotDetail', name: 'SpotDetail', params: { spotId: 42 } } as never}
      navigation={{} as never}
    />,
  );

const post = (payload: unknown) =>
  fireEvent(screen.getByTestId('kakao-map-webview'), 'message', {
    nativeEvent: { data: JSON.stringify(payload) },
  });

/** 위치 지도가 준비되면 상세 화면이 보낸 주소 조회 요청의 id 를 돌려준다. */
const readyAndGetGeocodeId = async (): Promise<number> => {
  await waitFor(() => expect(screen.getByTestId('kakao-map-webview')).toBeTruthy());
  await post({ type: 'ready' });
  const script = mockInjectJavaScript.mock.calls
    .map((call) => String(call[0]))
    .find((s) => s.includes('reverseGeocode('));
  expect(script).toBeDefined();
  return Number(/reverseGeocode\((\d+),/.exec(script as string)?.[1]);
};

describe('SpotDetailScreen address', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the stored road address without looking it up again', async () => {
    mockFetchSpotDetail.mockResolvedValue(detail);

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('spot-address')).toHaveTextContent('서울 성동구 성수이로 10'),
    );
    await post({ type: 'ready' });
    expect(
      mockInjectJavaScript.mock.calls.some((call) => String(call[0]).includes('reverseGeocode(')),
    ).toBe(false);
  });

  it('replaces a stored coordinate with the road address looked up on the map', async () => {
    mockFetchSpotDetail.mockResolvedValue({ ...detail, address: '37.54450, 127.05570' });

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('spot-address')).toHaveTextContent(/주소 확인 중/));

    const id = await readyAndGetGeocodeId();
    expect(
      mockInjectJavaScript.mock.calls.some((call) =>
        String(call[0]).includes(`reverseGeocode(${id}, 37.5445, 127.0557)`),
      ),
    ).toBe(true);

    await post({
      type: 'geocode',
      id,
      roadAddress: '서울 성동구 성수이로 10',
      lotAddress: '서울 성동구 성수동2가 1-1',
    });

    expect(screen.getByTestId('spot-address')).toHaveTextContent('서울 성동구 성수이로 10');
  });

  it('never shows the stored coordinate, even when the lookup finds no address', async () => {
    mockFetchSpotDetail.mockResolvedValue({ ...detail, address: '37.54450, 127.05570' });

    await renderScreen();
    const id = await readyAndGetGeocodeId();
    await post({ type: 'geocode', id, roadAddress: null, lotAddress: null });

    expect(screen.getByTestId('spot-address')).toHaveTextContent('주소 정보 없음');
  });

  it('looks up legacy spots stored without an address and falls back to a placeholder', async () => {
    mockFetchSpotDetail.mockResolvedValue({ ...detail, address: null });

    await renderScreen();
    const id = await readyAndGetGeocodeId();
    await post({ type: 'geocode', id, roadAddress: null, lotAddress: null });

    expect(screen.getByTestId('spot-address')).toHaveTextContent('주소 정보 없음');
  });
});
