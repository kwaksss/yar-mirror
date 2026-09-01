import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useCurrentLocation } from './useCurrentLocation';
import { FALLBACK_CENTER, LOCATION_TIMEOUT_MS } from '../config/constants';

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
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
});
