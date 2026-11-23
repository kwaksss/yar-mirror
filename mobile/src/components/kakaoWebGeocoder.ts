import type { KakaoAddressPayload } from '../utils/address';
import type { Place } from '../hooks/usePlaceSearch';

/**
 * 웹 전용 역지오코딩.
 *
 * 웹의 지도는 srcDoc iframe 안에서 돈다. 그 안의 카카오 SDK 가 주소 조회 API(coord2address)를
 * 부르면 호출한 곳이 iframe 주소 `about://` 로 전달되어 401(domain mismatched)로 거부된다.
 * 지도 SDK 파일 자체는 부모 페이지 주소로 받아지므로 지도는 뜨지만 주소만 항상 실패했다.
 *
 * 그래서 웹에서는 앱 페이지(부모 창)에 카카오 SDK 를 따로 불러와 주소를 조회한다.
 * 호출한 곳이 앱 주소(예: http://localhost:8081)가 되어, 카카오 콘솔에 등록된 도메인과 맞는다.
 */

type KakaoGeocoderDoc = {
  road_address?: { address_name?: string } | null;
  address?: { address_name?: string } | null;
};

type KakaoServices = {
  maps: {
    load: (callback: () => void) => void;
    services: {
      Geocoder: new () => {
        coord2Address: (
          longitude: number,
          latitude: number,
          callback: (result: unknown, status: unknown) => void,
        ) => void;
      };
      Places: new () => {
        keywordSearch: (query: string, callback: (result: unknown, status: unknown) => void) => void;
      };
      Status: { OK: string; ZERO_RESULT: string };
    };
  };
};

const SCRIPT_ID = 'kakao-maps-services-sdk';

let loading: Promise<KakaoServices> | null = null;

function loadServices(jsKey: string): Promise<KakaoServices> {
  if (loading) return loading;

  loading = new Promise<KakaoServices>((resolve, reject) => {
    const ready = () => {
      const kakao = (window as unknown as { kakao?: KakaoServices }).kakao;
      if (!kakao?.maps) {
        reject(new Error('Kakao Maps SDK did not load'));
        return;
      }
      kakao.maps.load(() => resolve(kakao));
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if ((window as unknown as { kakao?: unknown }).kakao) ready();
      else existing.addEventListener('load', ready, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      jsKey,
    )}&libraries=services&autoload=false`;
    script.addEventListener('load', ready, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Kakao Maps SDK failed to load')),
      { once: true },
    );
    document.head.appendChild(script);
  });

  // 실패하면 다음 요청에서 다시 시도할 수 있게 비운다.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

const EMPTY: KakaoAddressPayload = { roadAddress: null, lotAddress: null };

/** 좌표의 도로명/지번 주소를 조회한다. 실패해도 예외 대신 빈 결과를 돌려준다. */
export async function reverseGeocodeOnWeb(
  jsKey: string,
  latitude: number,
  longitude: number,
): Promise<KakaoAddressPayload> {
  let kakao: KakaoServices;
  try {
    kakao = await loadServices(jsKey);
  } catch {
    return EMPTY;
  }

  return new Promise<KakaoAddressPayload>((resolve) => {
    try {
      // coord2Address 는 (경도, 위도) 순서다.
      new kakao.maps.services.Geocoder().coord2Address(longitude, latitude, (result, status) => {
        const docs = status === kakao.maps.services.Status.OK && Array.isArray(result) ? result : [];
        const doc = docs[0] as KakaoGeocoderDoc | undefined;
        resolve(
          doc
            ? {
                roadAddress: doc.road_address?.address_name ?? null,
                lotAddress: doc.address?.address_name ?? null,
              }
            : EMPTY,
        );
      });
    } catch {
      resolve(EMPTY);
    }
  });
}

type KakaoPlaceDoc = {
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  x?: string;
  y?: string;
};

/**
 * 검색어로 장소를 찾는다. 주소 조회와 같은 이유로 iframe 이 아니라 이 페이지에서 부른다.
 * 결과 0건은 failed: false 와 빈 목록이다.
 */
export async function searchPlacesOnWeb(
  jsKey: string,
  query: string,
): Promise<{ places: Place[]; failed: boolean }> {
  const failed = { places: [], failed: true };
  let kakao: KakaoServices;
  try {
    kakao = await loadServices(jsKey);
  } catch {
    return failed;
  }

  return new Promise((resolve) => {
    try {
      new kakao.maps.services.Places().keywordSearch(query, (result, status) => {
        const { OK, ZERO_RESULT } = kakao.maps.services.Status;
        if (status !== OK && status !== ZERO_RESULT) {
          resolve(failed);
          return;
        }
        const docs = (status === OK && Array.isArray(result) ? result : []) as KakaoPlaceDoc[];
        resolve({
          failed: false,
          places: docs.map((doc) => ({
            name: doc.place_name ?? '',
            address: doc.road_address_name || doc.address_name || null,
            latitude: Number(doc.y),
            longitude: Number(doc.x),
          })),
        });
      });
    } catch {
      resolve(failed);
    }
  });
}
