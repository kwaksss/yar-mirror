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
 *
 * On web the same HTML runs in an iframe (KakaoMapView.web.tsx): messages go out through
 * `window.parent.postMessage`, and the parent calls `window.MirrorSpot.*` directly.
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
      var data = JSON.stringify(payload);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(data);
      } else if (window.parent && window.parent !== window) {
        // 웹에서는 이 HTML 이 iframe 안에서 돌기 때문에 부모 창으로 보낸다.
        window.parent.postMessage({ source: 'mirrorspot-map', data: data }, '*');
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
        var selectedMarker = null;
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
          // 스팟 등록 화면에서 사용자가 고른 위치를 표시하는 단일 마커. null 이면 지운다.
          setSelected: function (lat, lng) {
            if (lat === null || lng === null) {
              if (selectedMarker) selectedMarker.setMap(null);
              selectedMarker = null;
              return;
            }
            var position = new kakao.maps.LatLng(lat, lng);
            if (!selectedMarker) {
              selectedMarker = new kakao.maps.Marker({ map: map, position: position, zIndex: 10 });
            } else {
              selectedMarker.setPosition(position);
              selectedMarker.setMap(map);
            }
          },
          // 좌표를 화면 가운데보다 offsetY(px)만큼 위에 오도록 부드럽게 옮긴다.
          // 아래쪽을 가리는 미리보기 시트 위, 보이는 영역의 가운데에 마커를 두기 위해서다.
          focusOn: function (lat, lng, offsetY) {
            var target = new kakao.maps.LatLng(lat, lng);
            var projection = map.getProjection();
            var point = projection.containerPointFromCoords(target);
            var nextCenter = projection.coordsFromContainerPoint(
              new kakao.maps.Point(point.x, point.y + (offsetY || 0))
            );
            map.panTo(nextCenter);
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
