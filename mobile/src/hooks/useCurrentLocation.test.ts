import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useCurrentLocation } from './useCurrentLocation';
import { FALLBACK_CENTER, LOCATION_TIMEOUT_MS } from '../config/constants';

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const mocked = Location as jest.Mocked<typeof Location>;

const gangnam = { latitude: 37.4979, longitude: 127.0276 };

describe('useCurrentLocation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('centres on the device position when permission is granted', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as any);
    mocked.getCurrentPositionAsync.mockResolvedValue({ coords: gangnam } as any);

    const { result } = await renderHook(() => useCurrentLocation());

    await waitFor(() => expect(result.current.permission).toBe('granted'));
    expect(result.current.center).toEqual(gangnam);
    expect(result.current.usingFallback).toBe(false);
  });

  it('falls back to the default centre when permission is denied', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
    } as any);

    const { result } = await renderHook(() => useCurrentLocation());

    await waitFor(() => expect(result.current.permission).toBe('denied'));
    expect(result.current.center).toEqual(FALLBACK_CENTER);
    expect(result.current.usingFallback).toBe(true);
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('falls back when the position fix throws even though permission was granted', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as any);
    mocked.getCurrentPositionAsync.mockRejectedValue(new Error('location unavailable'));

    const { result } = await renderHook(() => useCurrentLocation());

    await waitFor(() => expect(result.current.permission).toBe('denied'));
    expect(result.current.center).toEqual(FALLBACK_CENTER);
    expect(result.current.usingFallback).toBe(true);
  });

  it('falls back when the fix does not arrive within LOCATION_TIMEOUT_MS', async () => {
    jest.useFakeTimers();
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as any);
    mocked.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}) as any);

    const { result } = await renderHook(() => useCurrentLocation());

    await act(async () => {
      jest.advanceTimersByTime(LOCATION_TIMEOUT_MS);
    });

    expect(result.current.usingFallback).toBe(true);
    expect(result.current.center).toEqual(FALLBACK_CENTER);
    jest.useRealTimers();
  });

  it('recovers after the user grants permission on a re-request', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
    } as any);

    const { result } = await renderHook(() => useCurrentLocation());
    await waitFor(() => expect(result.current.permission).toBe('denied'));

    mocked.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as any);
    mocked.getCurrentPositionAsync.mockResolvedValue({ coords: gangnam } as any);

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(result.current.permission).toBe('granted');
    expect(result.current.center).toEqual(gangnam);
  });

  describe('watch', () => {
    const grantWithFix = () => {
      mocked.requestForegroundPermissionsAsync.mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
      } as any);
      mocked.getCurrentPositionAsync.mockResolvedValue({ coords: gangnam } as any);
    };

    it('does not subscribe unless asked to', async () => {
      grantWithFix();
      const { result } = await renderHook(() => useCurrentLocation());

      await waitFor(() => expect(result.current.permission).toBe('granted'));
      expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
      expect(result.current.myPosition).toBeNull();
    });

    it('follows position updates every 5m without moving the initial centre', async () => {
      grantWithFix();
      let emit: (position: unknown) => void = () => undefined;
      const remove = jest.fn();
      mocked.watchPositionAsync.mockImplementation(async (_options, callback) => {
        emit = callback as typeof emit;
        return { remove } as any;
      });

      const { result, unmount } = await renderHook(() => useCurrentLocation({ watch: true }));

      await waitFor(() => expect(result.current.myPosition).toEqual(gangnam));
      expect(mocked.watchPositionAsync).toHaveBeenCalledWith(
        // GPS 정밀도. Balanced(3)는 iOS 에서 약 100m 라 걸어도 점이 그대로였다.
        expect.objectContaining({ distanceInterval: 5, accuracy: 4 }),
        expect.any(Function),
      );

      const moved = { latitude: 37.4985, longitude: 127.028 };
      await act(async () => emit({ coords: moved }));

      expect(result.current.myPosition).toEqual(moved);
      expect(result.current.center).toEqual(gangnam);

      await unmount();
      expect(remove).toHaveBeenCalled();
    });

    it('never subscribes when permission is denied', async () => {
      mocked.requestForegroundPermissionsAsync.mockResolvedValue({
        status: Location.PermissionStatus.DENIED,
      } as any);

      const { result } = await renderHook(() => useCurrentLocation({ watch: true }));

      await waitFor(() => expect(result.current.permission).toBe('denied'));
      expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
      expect(result.current.myPosition).toBeNull();
    });
  });
});
