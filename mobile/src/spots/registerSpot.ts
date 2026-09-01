import type {
  CreateSpotRequest,
  CreateSpotResponse,
  Spot,
  SpotDetail,
} from '../types/spot';

export type RegisterSpotDeps = {
  createSpot: (payload: CreateSpotRequest) => Promise<CreateSpotResponse>;
  uploadPhoto: (
    uploadUrl: string,
    fileUri: string,
    contentType: string,
    method: string,
  ) => Promise<void>;
  confirmUpload: (spotId: number) => Promise<SpotDetail>;
  addOptimisticSpot: (spot: Spot) => void;
  removeSpot: (spotId: number) => void;
  replaceSpot: (spotId: number, next: Spot) => void;
};

export type RegisterSpotInput = CreateSpotRequest & {
  photoUri: string;
};

export class MissingPhotoError extends Error {
  constructor() {
    super('사진을 1장 첨부해야 스팟을 등록할 수 있습니다.');
  }
}

/**
 * POST /spots -> presigned upload -> POST /spots/{id}/confirm-upload.
 *
 * POST /spots returns a flat CreateSpotResponse, so the optimistic marker is
 * built locally from the returned spotId plus the submitted form data. Every
 * step after the spot row exists runs inside the try, so any failure — network,
 * storage, or a rejected confirmation — rolls the marker back.
 */
export async function registerSpot(
  input: RegisterSpotInput,
  deps: RegisterSpotDeps,
): Promise<SpotDetail> {
  if (!input.photoUri) throw new MissingPhotoError();

  const { photoUri, ...payload } = input;
  const created = await deps.createSpot(payload);

  try {
    deps.addOptimisticSpot({
      id: created.spotId,
      name: payload.name,
      address: payload.address ?? null,
      description: payload.description ?? null,
      photoUrl: created.photoUrl,
      photoUploadStatus: created.photoUploadStatus,
      latitude: payload.latitude,
      longitude: payload.longitude,
      distanceMeters: null,
    });

    await deps.uploadPhoto(
      created.uploadUrl,
      photoUri,
      payload.contentType,
      created.uploadMethod,
    );

    const confirmed = await deps.confirmUpload(created.spotId);
    deps.replaceSpot(created.spotId, confirmed);
    return confirmed;
  } catch (error) {
    deps.removeSpot(created.spotId);
    throw error;
  }
}
