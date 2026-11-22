import { displayableAddress, isCoordinateAddress, pickKakaoAddress } from './address';

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

describe('isCoordinateAddress', () => {
  it('recognises the coordinate fallback stored when the lookup failed', () => {
    expect(isCoordinateAddress('37.54450, 127.05570')).toBe(true);
    expect(isCoordinateAddress('-33.86880, 151.20930')).toBe(true);
  });

  it('does not mistake a real address for a coordinate', () => {
    expect(isCoordinateAddress('서울 성동구 성수이로 10')).toBe(false);
    expect(isCoordinateAddress('서울 성동구 성수동2가 1-1')).toBe(false);
  });
});

describe('displayableAddress', () => {
  it('passes a real address through', () => {
    expect(displayableAddress(' 서울 성동구 성수이로 10 ')).toBe('서울 성동구 성수이로 10');
  });

  it('hides empty values and legacy coordinate fallbacks', () => {
    expect(displayableAddress(null)).toBeNull();
    expect(displayableAddress('')).toBeNull();
    expect(displayableAddress('37.54450, 127.05570')).toBeNull();
  });
});
