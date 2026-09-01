import { MissingPhotoError, registerSpot, type RegisterSpotDeps } from './registerSpot';
import type { CreateSpotResponse, SpotDetail } from '../types/spot';

/**
 * Shapes below are copied from the backend DTOs
 * (spot/dto/CreateSpotResponse.java, spot/dto/SpotDetailResponse.java):
 * CreateSpotResponse is FLAT — there is no nested `spot` object — and ids are
 * JSON numbers. An earlier version of this test mocked a nested shape and
 * therefore passed against a client that crashed on the real response.
 */
const createResponse: CreateSpotResponse = {
  spotId: 42,
  photoUploadStatus: 'PENDING',
  photoUrl: 'http://localhost:8080/local-storage/spots/uuid.jpg',
  uploadUrl: 'http://localhost:8080/local-storage/spots/uuid.jpg',
  uploadMethod: 'PUT',
  uploadUrlExpiresAt: '2026-01-01T00:10:00Z',
};

const confirmedDetail: SpotDetail = {
  id: 42,
  name: '성수동 전신거울',
  address: '서울 성동구 성수이로 10',
  description: null,
  photoUrl: 'http://localhost:8080/local-storage/spots/uuid.jpg',
  photoUploadStatus: 'CONFIRMED',
  latitude: 37.5445,
  longitude: 127.0557,
  distanceMeters: null,
  uploaderId: 7,
  createdAt: '2026-01-01T00:00:00Z',
};

const input = {
  name: '성수동 전신거울',
  description: '자연광 좋음',
  latitude: 37.5445,
  longitude: 127.0557,
  contentType: 'image/jpeg',
  photoUri: 'file:///tmp/mirror.jpg',
};

function makeDeps(overrides: Partial<RegisterSpotDeps> = {}) {
  const calls: string[] = [];
  const deps: RegisterSpotDeps = {
    createSpot: jest.fn(async () => {
      calls.push('createSpot');
      return createResponse;
    }),
    uploadPhoto: jest.fn(async () => {
      calls.push('uploadPhoto');
    }),
    confirmUpload: jest.fn(async () => {
      calls.push('confirmUpload');
      return confirmedDetail;
    }),
    addOptimisticSpot: jest.fn(() => calls.push('addOptimisticSpot')),
    removeSpot: jest.fn(() => calls.push('removeSpot')),
    replaceSpot: jest.fn(() => calls.push('replaceSpot')),
    ...overrides,
  };
  return { deps, calls };
}

describe('registerSpot', () => {
  it('creates, uploads, confirms, and keeps the marker on success', async () => {
    const { deps, calls } = makeDeps();

    const result = await registerSpot(input, deps);

    expect(result).toEqual(confirmedDetail);
    expect(calls).toEqual([
      'createSpot',
      'addOptimisticSpot',
      'uploadPhoto',
      'confirmUpload',
      'replaceSpot',
    ]);
    expect(deps.createSpot).toHaveBeenCalledWith({
      name: input.name,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      contentType: 'image/jpeg',
    });
  });

  it('builds the optimistic marker from spotId plus the submitted form data', async () => {
    const { deps } = makeDeps();

    await registerSpot(input, deps);

    expect(deps.addOptimisticSpot).toHaveBeenCalledWith({
      id: 42,
      name: '성수동 전신거울',
      address: null,
      description: '자연광 좋음',
      photoUrl: createResponse.photoUrl,
      photoUploadStatus: 'PENDING',
      latitude: 37.5445,
      longitude: 127.0557,
      distanceMeters: null,
    });
    expect(deps.replaceSpot).toHaveBeenCalledWith(42, confirmedDetail);
    expect(deps.removeSpot).not.toHaveBeenCalled();
  });

  it('sends the reverse-geocoded address to POST /spots and onto the optimistic marker', async () => {
    const { deps } = makeDeps();

    await registerSpot({ ...input, address: '서울 성동구 성수이로 10' }, deps);

    expect(deps.createSpot).toHaveBeenCalledWith(
      expect.objectContaining({ address: '서울 성동구 성수이로 10' }),
    );
    expect(deps.addOptimisticSpot).toHaveBeenCalledWith(
      expect.objectContaining({ address: '서울 성동구 성수이로 10' }),
    );
  });

  it('still registers when reverse geocoding produced only a coordinate fallback', async () => {
    const { deps } = makeDeps();

    const result = await registerSpot({ ...input, address: '37.54450, 127.05570' }, deps);

    expect(result).toEqual(confirmedDetail);
    expect(deps.createSpot).toHaveBeenCalledWith(
      expect.objectContaining({ address: '37.54450, 127.05570' }),
    );
  });

  it('uploads with the presigned URL and the method the server minted', async () => {
    const { deps } = makeDeps();

    await registerSpot(input, deps);

    expect(deps.uploadPhoto).toHaveBeenCalledWith(
      createResponse.uploadUrl,
      'file:///tmp/mirror.jpg',
      'image/jpeg',
      'PUT',
    );
  });

  it('honours a non-PUT uploadMethod instead of hardcoding one', async () => {
    const { deps } = makeDeps({
      createSpot: jest.fn(async () => ({ ...createResponse, uploadMethod: 'POST' })),
    });

    await registerSpot(input, deps);

    expect(deps.uploadPhoto).toHaveBeenCalledWith(
      createResponse.uploadUrl,
      'file:///tmp/mirror.jpg',
      'image/jpeg',
      'POST',
    );
  });

  it('rolls the optimistic marker back when confirm-upload fails', async () => {
    const failure = new Error('confirm-upload rejected: object not found');
    const { deps, calls } = makeDeps({
      confirmUpload: jest.fn(async () => {
        throw failure;
      }),
    });

    await expect(registerSpot(input, deps)).rejects.toBe(failure);

    expect(calls).toEqual(['createSpot', 'addOptimisticSpot', 'uploadPhoto', 'removeSpot']);
    expect(deps.removeSpot).toHaveBeenCalledWith(42);
    expect(deps.replaceSpot).not.toHaveBeenCalled();
  });

  it('rolls back when the presigned upload itself fails', async () => {
    const failure = new Error('storage PUT failed');
    const { deps } = makeDeps({
      uploadPhoto: jest.fn(async () => {
        throw failure;
      }),
    });

    await expect(registerSpot(input, deps)).rejects.toBe(failure);

    expect(deps.confirmUpload).not.toHaveBeenCalled();
    expect(deps.removeSpot).toHaveBeenCalledWith(42);
  });

  it('rolls back rather than crashing if the optimistic add throws', async () => {
    const failure = new Error('store unavailable');
    const { deps } = makeDeps({
      addOptimisticSpot: jest.fn(() => {
        throw failure;
      }),
    });

    await expect(registerSpot(input, deps)).rejects.toBe(failure);

    expect(deps.removeSpot).toHaveBeenCalledWith(42);
  });

  it('refuses to start without a photo', async () => {
    const { deps } = makeDeps();

    await expect(registerSpot({ ...input, photoUri: '' }, deps)).rejects.toBeInstanceOf(
      MissingPhotoError,
    );
    expect(deps.createSpot).not.toHaveBeenCalled();
  });
});
