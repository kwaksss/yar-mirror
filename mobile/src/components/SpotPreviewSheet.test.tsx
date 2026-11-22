import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SpotPreviewSheet } from './SpotPreviewSheet';
import type { Spot } from '../types/spot';

const spot: Spot = {
  id: 42,
  name: '성수동 전신거울',
  address: '서울 성동구 성수이로 10',
  description: null,
  photoUrl: 'http://localhost:8080/local-storage/spots/uuid.jpg',
  photoUploadStatus: 'CONFIRMED',
  latitude: 37.5445,
  longitude: 127.0557,
  distanceMeters: 320,
};

describe('SpotPreviewSheet', () => {
  it('shows the name, distance, address and photo of the spot', async () => {
    await render(
      <SpotPreviewSheet spot={spot} distanceText="320m" onOpen={jest.fn()} onClose={jest.fn()} />,
    );

    expect(screen.getByText('성수동 전신거울')).toBeTruthy();
    expect(screen.getByTestId('spot-preview-distance')).toHaveTextContent('320m');
    expect(screen.getByText('서울 성동구 성수이로 10')).toBeTruthy();
    expect(screen.getByTestId('spot-preview-photo')).toBeTruthy();
  });

  it('hides the distance when it is unknown', async () => {
    await render(
      <SpotPreviewSheet spot={spot} distanceText={null} onOpen={jest.fn()} onClose={jest.fn()} />,
    );

    expect(screen.queryByTestId('spot-preview-distance')).toBeNull();
  });

  it('shows an upload message instead of a broken image while the photo is pending', async () => {
    await render(
      <SpotPreviewSheet
        spot={{ ...spot, photoUploadStatus: 'PENDING' }}
        distanceText={null}
        onOpen={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('spot-preview-photo')).toBeNull();
    expect(screen.getByText('사진을 올리는 중이에요')).toBeTruthy();
  });

  it('opens the detail when the sheet is tapped', async () => {
    const onOpen = jest.fn();
    await render(
      <SpotPreviewSheet spot={spot} distanceText="320m" onOpen={onOpen} onClose={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('spot-preview-open'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('closes without opening the detail when the close button is tapped', async () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    await render(
      <SpotPreviewSheet spot={spot} distanceText="320m" onOpen={onOpen} onClose={onClose} />,
    );

    fireEvent.press(screen.getByTestId('spot-preview-close'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
