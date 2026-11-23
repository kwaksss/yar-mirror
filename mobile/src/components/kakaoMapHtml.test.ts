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

  it('exposes a single selected-position marker that can be moved or cleared', () => {
    expect(html).toContain('setSelected: function (lat, lng)');
    expect(html).toContain('selectedMarker.setPosition(position)');
    expect(html).toContain('selectedMarker.setMap(null)');
  });

  it('pans to a coordinate shifted above the centre so the preview sheet does not hide it', () => {
    expect(html).toContain('focusOn: function (lat, lng, offsetY)');
    expect(html).toContain('point.y + (offsetY || 0)');
    expect(html).toContain('map.panTo(nextCenter)');
  });

  it('draws a movable my-location dot and reports when the user starts dragging', () => {
    expect(html).toContain('setMyLocation: function (lat, lng)');
    expect(html).toContain('new kakao.maps.CustomOverlay');
    expect(html).toContain('myLocation.setPosition(position)');
    expect(html).toContain("addListener(map, 'dragstart'");
    expect(html).toContain("type: 'dragstart'");
  });
});
