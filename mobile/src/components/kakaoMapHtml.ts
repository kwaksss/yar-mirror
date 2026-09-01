import type { LatLng } from '../types/geo';

export type KakaoMapHtmlOptions = {
  jsKey: string;
  center: LatLng;
  level: number;
};

/**
 * Kakao Maps has no React Native SDK, so the map is the JS SDK running inside a
 * WebView. Communication is one JSON channel each way: `postMessage` out,
 * `injectJavaScript` calling `window.MirrorSpot.*` in.
 */
export function buildKakaoMapHtml({ jsKey, center, level }: KakaoMapHtmlOptions): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
  </style>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(jsKey)}&libraries=services&autoload=false"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var send = function (payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    };

    var toRad = function (d) { return d * Math.PI / 180; };
    var distanceMeters = function (a, b) {
      var dLat = toRad(b.getLat() - a.getLat());
      var dLng = toRad(b.getLng() - a.getLng());
      var h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(toRad(a.getLat())) * Math.cos(toRad(b.getLat()))
        * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
    };

    if (!window.kakao || !window.kakao.maps) {
      send({ type: 'error', message: 'Kakao Maps SDK failed to load' });
    } else {
      kakao.maps.load(function () {
        var map = new kakao.maps.Map(document.getElementById('map'), {
          center: new kakao.maps.LatLng(${center.latitude}, ${center.longitude}),
          level: ${level}
        });

        var markers = [];
        var geocoder = null;

        var emitIdle = function () {
          var c = map.getCenter();
          var bounds = map.getBounds();
          send({
            type: 'idle',
            latitude: c.getLat(),
            longitude: c.getLng(),
            level: map.getLevel(),
            radius: Math.round(distanceMeters(bounds.getSouthWest(), bounds.getNorthEast()) / 2)
          });
        };

        kakao.maps.event.addListener(map, 'idle', emitIdle);
        kakao.maps.event.addListener(map, 'click', function (e) {
          send({
            type: 'mapPress',
            latitude: e.latLng.getLat(),
            longitude: e.latLng.getLng()
          });
        });

        window.MirrorSpot = {
          setMarkers: function (list) {
            markers.forEach(function (m) { m.setMap(null); });
            markers = list.map(function (item) {
              var marker = new kakao.maps.Marker({
                map: map,
                position: new kakao.maps.LatLng(item.latitude, item.longitude),
                title: item.name
              });
              kakao.maps.event.addListener(marker, 'click', function () {
                send({ type: 'markerPress', spotId: item.id });
              });
              return marker;
            });
          },
          setCenter: function (lat, lng) {
            map.setCenter(new kakao.maps.LatLng(lat, lng));
          },
          reverseGeocode: function (id, lat, lng) {
            var fail = function () {
              send({ type: 'geocode', id: id, roadAddress: null, lotAddress: null });
            };
            if (!kakao.maps.services || !kakao.maps.services.Geocoder) {
              fail();
              return;
            }
            if (!geocoder) geocoder = new kakao.maps.services.Geocoder();
            try {
              // coord2Address takes (longitude, latitude), in that order.
              geocoder.coord2Address(lng, lat, function (result, status) {
                var doc = status === kakao.maps.services.Status.OK && result ? result[0] : null;
                if (!doc) {
                  fail();
                  return;
                }
                send({
                  type: 'geocode',
                  id: id,
                  roadAddress: doc.road_address ? doc.road_address.address_name : null,
                  lotAddress: doc.address ? doc.address.address_name : null
                });
              });
            } catch (e) {
              fail();
            }
          }
        };

        send({ type: 'ready' });
        emitIdle();
      });
    }
  </script>
</body>
</html>`;
}
