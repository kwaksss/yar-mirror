import type { LatLng } from '../types/geo';

/** The two address forms Kakao's coord2Address returns for one coordinate. */
export type KakaoAddressPayload = {
  roadAddress?: string | null;
  lotAddress?: string | null;
};

/** 도로명 주소를 우선하고, 없으면 지번 주소를 쓴다. 둘 다 없으면 null. */
export function pickKakaoAddress(payload: KakaoAddressPayload): string | null {
  const road = payload.roadAddress?.trim();
  if (road) return road;

  const lot = payload.lotAddress?.trim();
  if (lot) return lot;

  return null;
}

/** 역지오코딩이 실패했을 때 주소 대신 제출하는 좌표 표기. */
export function formatCoordinateAddress({ latitude, longitude }: LatLng): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
