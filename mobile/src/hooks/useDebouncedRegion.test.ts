import { act, renderHook } from '@testing-library/react-native';
import { useDebouncedRegion } from './useDebouncedRegion';
import type { MapRegion } from '../types/geo';

const region = (latitude: number): MapRegion => ({
  latitude,
  longitude: 126.978,
  level: 5,
  radius: 2000,
});

const initial = region(37.5665);

describe('useDebouncedRegion', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts settled on the initial region', async () => {
    const { result } = await renderHook(() => useDebouncedRegion(initial, 500));
    expect(result.current.settledRegion).toEqual(initial);
  });

  it('does not settle before the delay elapses', async () => {
    const { result } = await renderHook(() => useDebouncedRegion(initial, 500));
    const onRegionChange = result.current.onRegionChange;

    await act(async () => {
      onRegionChange(region(37.6));
    });
    await act(async () => {
      jest.advanceTimersByTime(499);
    });

    expect(result.current.region).toEqual(region(37.6));
    expect(result.current.settledRegion).toEqual(initial);
  });

  it('settles once the map stops moving for the delay', async () => {
    const { result } = await renderHook(() => useDebouncedRegion(initial, 500));
    const onRegionChange = result.current.onRegionChange;

    await act(async () => {
      onRegionChange(region(37.6));
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.settledRegion).toEqual(region(37.6));
  });

  it('collapses a burst of idle events into a single settled region', async () => {
    const { result } = await renderHook(() => useDebouncedRegion(initial, 500));
    const onRegionChange = result.current.onRegionChange;

    await act(async () => {
      onRegionChange(region(37.6));
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {
      onRegionChange(region(37.7));
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.settledRegion).toEqual(initial);

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current.settledRegion).toEqual(region(37.7));
  });
});
