import { act, renderHook } from '@testing-library/react-native';
import { useReverseGeocode } from './useReverseGeocode';

const seongsu = { latitude: 37.5445, longitude: 127.0557 };
const gangnam = { latitude: 37.4979, longitude: 127.0276 };

describe('useReverseGeocode', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts idle with no request and no address', async () => {
    const { result } = await renderHook(() => useReverseGeocode(5000));

    expect(result.current.request).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.address).toBeNull();
  });

  it('emits a request carrying the coordinate for the WebView to look up', async () => {
    const { result } = await renderHook(() => useReverseGeocode(5000));

    await act(async () => {
      result.current.requestAddress(seongsu);
    });

    expect(result.current.request).toEqual({ id: 1, ...seongsu });
    expect(result.current.status).toBe('pending');
  });

  it('resolves the road address when the WebView replies', async () => {
    const { result } = await renderHook(() => useReverseGeocode(5000));

    await act(async () => {
      result.current.requestAddress(seongsu);
    });
    await act(async () => {
      result.current.handleResult({
        id: 1,
        roadAddress: '서울 성동구 성수이로 10',
        lotAddress: '서울 성동구 성수동2가 1-1',
      });
    });

    expect(result.current.status).toBe('resolved');
    expect(result.current.address).toBe('서울 성동구 성수이로 10');
  });

  it('fails without an address when Kakao knows no address for the coordinate', async () => {
    const { result } = await renderHook(() => useReverseGeocode(5000));

    await act(async () => {
      result.current.requestAddress(seongsu);
    });
    await act(async () => {
      result.current.handleResult({ id: 1, roadAddress: null, lotAddress: null });
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.address).toBeNull();
  });

  it('gives up rather than staying pending forever when no reply arrives', async () => {
    const { result } = await renderHook(() => useReverseGeocode(5000));

    await act(async () => {
      result.current.requestAddress(seongsu);
    });
    await act(async () => {
      jest.advanceTimersByTime(4999);
    });
    expect(result.current.status).toBe('pending');

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.address).toBeNull();
  });

  it('does not expire a request that already answered', async () => {
    const { result } = await renderHook(() => useReverseGeocode(5000));

    await act(async () => {
      result.current.requestAddress(seongsu);
    });
    await act(async () => {
      result.current.handleResult({ id: 1, roadAddress: '서울 성동구 성수이로 10' });
    });
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(result.current.status).toBe('resolved');
    expect(result.current.address).toBe('서울 성동구 성수이로 10');
  });

  it('drops a late reply for a coordinate the user already moved away from', async () => {
    const { result } = await renderHook(() => useReverseGeocode(5000));

    await act(async () => {
      result.current.requestAddress(seongsu);
    });
    await act(async () => {
      result.current.requestAddress(gangnam);
    });
    await act(async () => {
      result.current.handleResult({ id: 1, roadAddress: '서울 성동구 성수이로 10' });
    });

    expect(result.current.request).toEqual({ id: 2, ...gangnam });
    expect(result.current.status).toBe('pending');
    expect(result.current.address).toBeNull();

    await act(async () => {
      result.current.handleResult({ id: 2, roadAddress: '서울 강남구 테헤란로 1' });
    });

    expect(result.current.address).toBe('서울 강남구 테헤란로 1');
  });

  it('clears a resolved address while the next coordinate is looked up', async () => {
    const { result } = await renderHook(() => useReverseGeocode(5000));

    await act(async () => {
      result.current.requestAddress(seongsu);
    });
    await act(async () => {
      result.current.handleResult({ id: 1, roadAddress: '서울 성동구 성수이로 10' });
    });
    await act(async () => {
      result.current.requestAddress(gangnam);
    });

    expect(result.current.address).toBeNull();
    expect(result.current.status).toBe('pending');
  });
});
