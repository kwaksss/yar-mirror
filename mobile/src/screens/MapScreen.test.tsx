import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MapScreen } from './MapScreen';
import { resetSpots } from '../spots/spotsStore';
import type { Spot } from '../types/spot';

const mockFetchNearbySpots = jest.fn();
const mockInjectJavaScript = jest.fn();

jest.mock('../api/spots', () => ({
  fetchNearbySpots: (...args: unknown[]) => mockFetchNearbySpots(...args),
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

const spot: Spot = {
  id: 42,
  name: '성수동 전신거울',
  address: '서울 성동구 성수이로 10',
  description: null,
  photoUrl: 'http://localhost:8080/local-storage/spots/uuid.jpg',
  photoUploadStatus: 'CONFIRMED',
  latitude: 37.5445,
  longitude: 127.0557,
  distanceMeters: 320,
};

const post = (payload: unknown) =>
  fireEvent(screen.getByTestId('kakao-map-webview'), 'message', {
    nativeEvent: { data: JSON.stringify(payload) },
  });

const navigation = {
  navigate: jest.fn(),
  addListener: jest.fn(() => () => undefined),
};

const renderScreen = () =>
  render(
    <MapScreen
      navigation={navigation as never}
      route={{ key: 'Map', name: 'Map', params: undefined } as never}
    />,
  );

describe('MapScreen spot preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSpots();
    mockFetchNearbySpots.mockResolvedValue([spot]);
  });

  it('opens a preview sheet on marker tap instead of navigating straight away', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nearby-count')).toHaveTextContent('주변 1곳'));

    await post({ type: 'markerPress', spotId: 42 });

    expect(screen.getByTestId('spot-preview-sheet')).toBeTruthy();
    expect(screen.queryByTestId('add-spot-button')).toBeNull();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the detail when the preview is tapped', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nearby-count')).toHaveTextContent('주변 1곳'));
    await post({ type: 'markerPress', spotId: 42 });

    fireEvent.press(screen.getByTestId('spot-preview-open'));

    expect(navigation.navigate).toHaveBeenCalledWith('SpotDetail', { spotId: 42 });
  });

  it('closes the preview when the empty map is tapped', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nearby-count')).toHaveTextContent('주변 1곳'));
    await post({ type: 'markerPress', spotId: 42 });

    await post({ type: 'mapPress', latitude: 37.5, longitude: 127 });

    expect(screen.queryByTestId('spot-preview-sheet')).toBeNull();
    expect(screen.getByTestId('add-spot-button')).toBeTruthy();
  });

  it('pans the map to the tapped marker', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nearby-count')).toHaveTextContent('주변 1곳'));
    await post({ type: 'ready' });
    mockInjectJavaScript.mockClear();

    await post({ type: 'markerPress', spotId: 42 });

    const focus = mockInjectJavaScript.mock.calls
      .map((call) => String(call[0]))
      .find((script) => script.includes('focusOn'));
    expect(focus).toContain('focusOn(37.5445, 127.0557,');
  });

  it('pans to the newly registered spot when returning from registration', async () => {
    const { rerender } = await renderScreen();
    await post({ type: 'ready' });
    mockInjectJavaScript.mockClear();

    await rerender(
      <MapScreen
        navigation={navigation as never}
        route={
          {
            key: 'Map',
            name: 'Map',
            params: { focus: { latitude: 37.55, longitude: 127.04 } },
          } as never
        }
      />,
    );

    const focus = mockInjectJavaScript.mock.calls
      .map((call) => String(call[0]))
      .find((script) => script.includes('focusOn'));
    expect(focus).toContain('focusOn(37.55, 127.04, 0)');
  });
});

describe('MapScreen place search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSpots();
    mockFetchNearbySpots.mockResolvedValue([spot]);
  });

  it('searches through the map SDK and pans to the picked place', async () => {
    await renderScreen();
    await post({ type: 'ready' });
    mockInjectJavaScript.mockClear();

    await fireEvent.changeText(screen.getByTestId('place-search-input'), '망원역');
    await fireEvent(screen.getByTestId('place-search-input'), 'submitEditing');

    const searchScript = mockInjectJavaScript.mock.calls
      .map((call) => String(call[0]))
      .find((script) => script.includes('searchPlaces'));
    expect(searchScript).toContain('searchPlaces(1, "망원역")');

    await post({
      type: 'places',
      id: 1,
      failed: false,
      places: [{ name: '망원역 6호선', address: null, latitude: 37.5559, longitude: 126.9101 }],
    });
    await fireEvent.press(screen.getByTestId('place-search-result-0'));

    const focus = mockInjectJavaScript.mock.calls
      .map((call) => String(call[0]))
      .find((script) => script.includes('focusOn'));
    expect(focus).toContain('focusOn(37.5559, 126.9101, 0)');
    expect(screen.queryByTestId('place-search-results')).toBeNull();
  });
});

