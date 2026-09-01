import { useSyncExternalStore } from 'react';
import type { Spot } from '../types/spot';

type Listener = () => void;

let spots: Spot[] = [];
const listeners = new Set<Listener>();

function emit(next: Spot[]): void {
  spots = next;
  listeners.forEach((listener) => listener());
}

export function getSpots(): Spot[] {
  return spots;
}

export function setSpots(next: Spot[]): void {
  const optimistic = spots.filter((spot) => spot.photoUploadStatus === 'PENDING');
  const fetchedIds = new Set(next.map((spot) => spot.id));
  emit([...next, ...optimistic.filter((spot) => !fetchedIds.has(spot.id))]);
}

export function addOptimisticSpot(spot: Spot): void {
  emit([...spots.filter((existing) => existing.id !== spot.id), spot]);
}

export function removeSpot(spotId: number): void {
  emit(spots.filter((spot) => spot.id !== spotId));
}

export function replaceSpot(spotId: number, next: Spot): void {
  emit(spots.map((spot) => (spot.id === spotId ? next : spot)));
}

export function resetSpots(): void {
  emit([]);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSpots(): Spot[] {
  return useSyncExternalStore(subscribe, getSpots, getSpots);
}
