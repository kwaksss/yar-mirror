import axios from 'axios';
import { apiClient } from './client';
import type {
  CreateSpotRequest,
  CreateSpotResponse,
  Spot,
  SpotDetail,
} from '../types/spot';

export type NearbySpotsQuery = {
  latitude: number;
  longitude: number;
  radius: number;
};

export function fetchNearbySpots(query: NearbySpotsQuery): Promise<Spot[]> {
  return apiClient
    .get<Spot[]>('/spots', {
      params: { lat: query.latitude, lng: query.longitude, radius: query.radius },
    })
    .then((res) => res.data);
}

export function fetchSpotDetail(
  spotId: number,
  origin?: { latitude: number; longitude: number },
): Promise<SpotDetail> {
  return apiClient
    .get<SpotDetail>(`/spots/${spotId}`, {
      params: origin ? { lat: origin.latitude, lng: origin.longitude } : undefined,
    })
    .then((res) => res.data);
}

export function createSpot(payload: CreateSpotRequest): Promise<CreateSpotResponse> {
  return apiClient.post<CreateSpotResponse>('/spots', payload).then((res) => res.data);
}

/**
 * Uploads straight to object storage with the presigned URL and the method the
 * server minted it for. Deliberately not `apiClient`: the presigned URL carries
 * its own authorization and must not receive our bearer token.
 */
export async function uploadPhoto(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
  method: string,
): Promise<void> {
  const file = await fetch(fileUri);
  const blob = await file.blob();
  await axios.request({
    url: uploadUrl,
    method,
    data: blob,
    headers: { 'Content-Type': contentType },
  });
}

export function confirmUpload(spotId: number): Promise<SpotDetail> {
  return apiClient
    .post<SpotDetail>(`/spots/${spotId}/confirm-upload`)
    .then((res) => res.data);
}
