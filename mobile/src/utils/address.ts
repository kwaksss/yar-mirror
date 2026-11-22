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

const COORDINATE_ADDRESS = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/;

/**
 * 예전 버전이 주소 조회에 실패했을 때 주소 대신 저장하던 좌표 표기("37.54450, 127.05570")인지 확인한다.
 * 지금은 실패하면 주소를 비워 두지만, 이미 저장된 데이터에는 남아 있을 수 있다.
 */
export function isCoordinateAddress(address: string): boolean {
  return COORDINATE_ADDRESS.test(address);
}

/** 화면에 보여 줄 수 있는 주소만 돌려준다. 비어 있거나 좌표 표기면 null. */
export function displayableAddress(address: string | null | undefined): string | null {
  const trimmed = address?.trim();
  if (!trimmed || isCoordinateAddress(trimmed)) return null;
  return trimmed;
}
