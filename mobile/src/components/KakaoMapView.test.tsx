import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { KakaoMapView } from './KakaoMapView';
import type { Spot } from '../types/spot';

const mockInjectJavaScript = jest.fn();

jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactModule = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    WebView: ReactModule.forwardRef((props: any, ref: any) => {
      ReactModule.useImperativeHandle(ref, () => ({
        injectJavaScript: mockInjectJavaScript,
      }));
      return ReactModule.createElement(View, {
        testID: props.testID,
        onMessage: props.onMessage,
      });
    }),
  };
});

jest.mock('../config/env', () => ({
  getAppExtra: () => ({
    apiBaseUrl: 'http://localhost:8080',
    kakaoJsKey: 'test-js-key',
    kakaoRestApiKey: '',
    googleClientId: '',
  }),
}));

const spots: Spot[] = [
  {
    id: 42,
    name: '성수동 전신거울',
    address: null,
    description: null,
    photoUrl: null,
    photoUploadStatus: 'CONFIRMED',
    latitude: 37.5445,
    longitude: 127.0557,
    distanceMeters: 320,
  },
];

const post = (payload: unknown) =>
  fireEvent(screen.getByTestId('kakao-map-webview'), 'message', {
    nativeEvent: { data: JSON.stringify(payload) },
  });

const injectedScripts = () => mockInjectJavaScript.mock.calls.map((call) => String(call[0]));

describe('KakaoMapView marker injection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('replays the marker set once the WebView reports ready', async () => {
    await render(
      <KakaoMapView center={{ latitude: 37.5665, longitude: 126.978 }} markers={spots} />,
    );

    // Before 'ready' the Kakao SDK has not defined window.MirrorSpot, so
    // injecting would be a silent no-op — nothing should be sent yet.
    expect(injectedScripts().some((s) => s.includes('setMarkers'))).toBe(false);

    await post({ type: 'ready' });

    const markerScript = injectedScripts().find((s) => s.includes('setMarkers'));
    expect(markerScript).toBeDefined();
    expect(markerScript).toContain('"id":42');
    expect(markerScript).toContain('37.5445');
  });

  it('re-centres on ready using the latest center, not the one baked into the HTML', async () => {
    await render(
      <KakaoMapView center={{ latitude: 37.4979, longitude: 127.0276 }} markers={spots} />,
    );

    await post({ type: 'ready' });

    const centerScript = injectedScripts().find((s) => s.includes('setCenter'));
    expect(centerScript).toContain('37.4979');
    expect(centerScript).toContain('127.0276');
  });

  it('injects immediately for marker updates that arrive after ready', async () => {
    const { rerender } = await render(
      <KakaoMapView center={{ latitude: 37.5665, longitude: 126.978 }} markers={[]} />,
    );

    await post({ type: 'ready' });
    mockInjectJavaScript.mockClear();

    await rerender(
      <KakaoMapView center={{ latitude: 37.5665, longitude: 126.978 }} markers={spots} />,
    );

    expect(injectedScripts().some((s) => s.includes('"id":42'))).toBe(true);
  });

  it('forwards marker taps with a numeric spot id', async () => {
    const onMarkerPress = jest.fn();
    await render(
      <KakaoMapView
        center={{ latitude: 37.5665, longitude: 126.978 }}
        markers={spots}
        onMarkerPress={onMarkerPress}
      />,
    );

    await post({ type: 'markerPress', spotId: 42 });

    expect(onMarkerPress).toHaveBeenCalledWith(42);
  });

  it('forwards debounceable idle regions', async () => {
    const onRegionChange = jest.fn();
    await render(
      <KakaoMapView
        center={{ latitude: 37.5665, longitude: 126.978 }}
        onRegionChange={onRegionChange}
      />,
    );

    await post({
      type: 'idle',
      latitude: 37.6,
      longitude: 127.1,
      level: 4,
      radius: 1500,
    });

    expect(onRegionChange).toHaveBeenCalledWith({
      latitude: 37.6,
      longitude: 127.1,
      level: 4,
      radius: 1500,
    });
  });

  it('replays a geocode request issued before the SDK finished loading', async () => {
    await render(
      <KakaoMapView
        center={{ latitude: 37.5665, longitude: 126.978 }}
        geocodeRequest={{ id: 1, latitude: 37.5445, longitude: 127.0557 }}
      />,
    );

    expect(injectedScripts().some((s) => s.includes('reverseGeocode'))).toBe(false);

    await post({ type: 'ready' });

    const script = injectedScripts().find((s) => s.includes('reverseGeocode'));
    expect(script).toContain('reverseGeocode(1, 37.5445, 127.0557)');
  });

  it('injects a geocode request that arrives after ready', async () => {
    const { rerender } = await render(
      <KakaoMapView center={{ latitude: 37.5665, longitude: 126.978 }} geocodeRequest={null} />,
    );

    await post({ type: 'ready' });
    mockInjectJavaScript.mockClear();

    await rerender(
      <KakaoMapView
        center={{ latitude: 37.5665, longitude: 126.978 }}
        geocodeRequest={{ id: 2, latitude: 37.4979, longitude: 127.0276 }}
      />,
    );

    expect(injectedScripts().some((s) => s.includes('reverseGeocode(2, 37.4979, 127.0276)'))).toBe(
      true,
    );
  });

  it('forwards the geocode reply with its request id and both address forms', async () => {
    const onGeocodeResult = jest.fn();
    await render(
      <KakaoMapView
        center={{ latitude: 37.5665, longitude: 126.978 }}
        onGeocodeResult={onGeocodeResult}
      />,
    );

    await post({
      type: 'geocode',
      id: 3,
      roadAddress: '서울 성동구 성수이로 10',
      lotAddress: '서울 성동구 성수동2가 1-1',
    });

    expect(onGeocodeResult).toHaveBeenCalledWith({
      id: 3,
      roadAddress: '서울 성동구 성수이로 10',
      lotAddress: '서울 성동구 성수동2가 1-1',
    });
  });

  it('forwards a failed geocode lookup as null addresses rather than dropping it', async () => {
    const onGeocodeResult = jest.fn();
    await render(
      <KakaoMapView
        center={{ latitude: 37.5665, longitude: 126.978 }}
        onGeocodeResult={onGeocodeResult}
      />,
    );

    await post({ type: 'geocode', id: 4, roadAddress: null, lotAddress: null });

    expect(onGeocodeResult).toHaveBeenCalledWith({
      id: 4,
      roadAddress: null,
      lotAddress: null,
    });
  });

  it('ignores malformed WebView payloads', async () => {
    const onRegionChange = jest.fn();
    await render(
      <KakaoMapView
        center={{ latitude: 37.5665, longitude: 126.978 }}
        onRegionChange={onRegionChange}
      />,
    );

    await fireEvent(screen.getByTestId('kakao-map-webview'), 'message', {
      nativeEvent: { data: 'not json' },
    });

    expect(onRegionChange).not.toHaveBeenCalled();
  });
});
