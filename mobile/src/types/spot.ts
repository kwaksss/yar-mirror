export type PhotoUploadStatus = 'PENDING' | 'CONFIRMED';

/** Mirrors the backend SpotSummaryResponse. Ids are JSON numbers (Java Long). */
export type Spot = {
  id: number;
  name: string;
  address: string | null;
  description: string | null;
  photoUrl: string | null;
  photoUploadStatus: PhotoUploadStatus;
  latitude: number;
  longitude: number;
  /** Null for a locally created spot that the server has not measured yet. */
  distanceMeters: number | null;
};

/** Mirrors the backend SpotDetailResponse (GET /spots/{id}, confirm-upload). */
export type SpotDetail = Spot & {
  uploaderId: number | null;
  /** ISO-8601 UTC, e.g. "2026-01-01T00:10:00Z". */
  createdAt: string | null;
};

export type CreateSpotRequest = {
  latitude: number;
  longitude: number;
  name: string;
  address?: string;
  description?: string;
  contentType: string;
};

/** Mirrors the backend CreateSpotResponse — flat, no nested spot object. */
export type CreateSpotResponse = {
  spotId: number;
  photoUploadStatus: PhotoUploadStatus;
  photoUrl: string;
  uploadUrl: string;
  uploadMethod: string;
  uploadUrlExpiresAt: string;
};
