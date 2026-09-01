import {
  addOptimisticSpot,
  getSpots,
  removeSpot,
  replaceSpot,
  resetSpots,
  setSpots,
} from './spotsStore';
import type { Spot } from '../types/spot';

const spot = (id: number, status: Spot['photoUploadStatus'] = 'CONFIRMED'): Spot => ({
  id,
  name: `spot ${id}`,
  address: null,
  description: null,
  photoUrl: null,
  latitude: 37.5,
  longitude: 127,
  photoUploadStatus: status,
  distanceMeters: null,
});

describe('spotsStore', () => {
  beforeEach(() => resetSpots());

  it('keeps an optimistic marker visible across a refetch that has not caught up', () => {
    addOptimisticSpot(spot(99, 'PENDING'));
    setSpots([spot(1), spot(2)]);

    expect(getSpots().map((s) => s.id)).toEqual([1, 2, 99]);
  });

  it('drops the optimistic copy once the server returns the same id', () => {
    addOptimisticSpot(spot(99, 'PENDING'));
    setSpots([spot(99)]);

    expect(getSpots()).toEqual([spot(99)]);
  });

  it('removes and replaces by id', () => {
    setSpots([spot(1), spot(2)]);

    replaceSpot(1, { ...spot(1), name: 'renamed' });
    expect(getSpots()[0].name).toBe('renamed');

    removeSpot(1);
    expect(getSpots().map((s) => s.id)).toEqual([2]);
  });
});
