import { formatCoordinateAddress, pickKakaoAddress } from './address';

describe('pickKakaoAddress', () => {
  it('prefers the road address over the lot address', () => {
    expect(
      pickKakaoAddress({
        roadAddress: '서울 성동구 성수이로 10',
        lotAddress: '서울 성동구 성수동2가 1-1',
      }),
    ).toBe('서울 성동구 성수이로 10');
  });

  it('falls back to the lot address when a coordinate has no road address', () => {
    expect(
      pickKakaoAddress({ roadAddress: null, lotAddress: '서울 성동구 성수동2가 1-1' }),
    ).toBe('서울 성동구 성수동2가 1-1');
  });

  it('treats blank strings as missing', () => {
    expect(pickKakaoAddress({ roadAddress: '   ', lotAddress: '' })).toBeNull();
  });

  it('returns null when Kakao knows no address for the coordinate', () => {
    expect(pickKakaoAddress({ roadAddress: null, lotAddress: null })).toBeNull();
    expect(pickKakaoAddress({})).toBeNull();
  });
});

describe('formatCoordinateAddress', () => {
  it('renders a five-decimal coordinate pair as the fallback address', () => {
    expect(formatCoordinateAddress({ latitude: 37.5445, longitude: 127.0557 })).toBe(
      '37.54450, 127.05570',
    );
  });
});
