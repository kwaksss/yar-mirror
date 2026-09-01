import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { SpotDetailScreen } from './SpotDetailScreen';
import type { SpotDetail } from '../types/spot';

const mockFetchSpotDetail = jest.fn();

jest.mock('../api/spots', () => ({
  fetchSpotDetail: (...args: unknown[]) => mockFetchSpotDetail(...args),
}));

jest.mock('../hooks/useCurrentLocation', () => ({
  useCurrentLocation: () => ({
    center: { latitude: 37.5665, longitude: 126.978 },
    usingFallback: false,
    permission: 'granted',
    requestPermission: jest.fn(),
  }),
}));

const detail: SpotDetail = {
  id: 42,
  name: '성수동 전신거울',
  address: '서울 성동구 성수이로 10',
  description: null,
  photoUrl: 'http://localhost:8080/local-storage/spots/uuid.jpg',
  photoUploadStatus: 'CONFIRMED',
  latitude: 37.5445,
  longitude: 127.0557,
  distanceMeters: 320,
  uploaderId: 7,
  createdAt: '2026-01-01T00:00:00Z',
};

const renderScreen = () =>
  render(
    <SpotDetailScreen
      route={{ key: 'SpotDetail', name: 'SpotDetail', params: { spotId: 42 } } as never}
      navigation={{} as never}
    />,
  );

describe('SpotDetailScreen address', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the address the spot was registered with', async () => {
    mockFetchSpotDetail.mockResolvedValue(detail);

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('spot-address')).toHaveTextContent('서울 성동구 성수이로 10'),
    );
  });

  it('shows the coordinate fallback when reverse geocoding failed at registration', async () => {
    mockFetchSpotDetail.mockResolvedValue({ ...detail, address: '37.54450, 127.05570' });

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('spot-address')).toHaveTextContent('37.54450, 127.05570'),
    );
  });

  it('falls back to a placeholder for legacy spots stored without an address', async () => {
    mockFetchSpotDetail.mockResolvedValue({ ...detail, address: null });

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('spot-address')).toHaveTextContent('주소 정보 없음'),
    );
  });
});
