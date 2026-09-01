import { buildKakaoMapHtml } from './kakaoMapHtml';

describe('buildKakaoMapHtml', () => {
  const html = buildKakaoMapHtml({
    jsKey: 'test-js-key',
    center: { latitude: 37.5665, longitude: 126.978 },
    level: 5,
  });

  it('loads the Kakao Maps JS SDK with the configured key', () => {
    expect(html).toContain('dapi.kakao.com/v2/maps/sdk.js?appkey=test-js-key');
    expect(html).toContain('autoload=false');
  });

  it('centres the map on the supplied coordinate', () => {
    expect(html).toContain('new kakao.maps.LatLng(37.5665, 126.978)');
    expect(html).toContain('level: 5');
  });

  it('wires the idle, click, and marker channels back to React Native', () => {
    expect(html).toContain("addListener(map, 'idle'");
    expect(html).toContain("type: 'markerPress'");
    expect(html).toContain("type: 'mapPress'");
    expect(html).toContain('window.ReactNativeWebView.postMessage');
    expect(html).toContain('window.MirrorSpot');
  });

  it('loads the services library so reverse geocoding is available', () => {
    expect(html).toContain('libraries=services');
  });

  it('exposes reverse geocoding and reports failures instead of going silent', () => {
    expect(html).toContain('reverseGeocode: function (id, lat, lng)');
    // coord2Address takes longitude first — a swap here would geocode the wrong place.
    expect(html).toContain('geocoder.coord2Address(lng, lat');
    expect(html).toContain("type: 'geocode'");
    expect(html).toContain('roadAddress: null, lotAddress: null');
  });
});
