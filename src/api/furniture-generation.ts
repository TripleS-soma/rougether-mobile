import { Platform } from 'react-native';

import { apiGet, apiGetList, apiPost } from '@/api/client';

export type FurniturePhoto = { uri: string; name: string; type: string };
export type FurnitureCreditBalance = { available: number; reserved: number };
export type FurnitureJob = {
  id: string;
  status: 'UPLOADING' | 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  assetKey: string | null;
  userItemId: number | null;
  failureCode: string | null;
};
export const isFurnitureJobActive = (job: FurnitureJob) =>
  ['UPLOADING', 'QUEUED', 'PROCESSING'].includes(job.status);

export const fetchFurnitureCredits = () => apiGet<FurnitureCreditBalance>('/me/furniture-credits');
export const fetchFurnitureJobs = () => apiGetList<FurnitureJob>('/me/furniture-generations');

export async function createFurniture(photo: FurniturePhoto, requestId: string) {
  const form = new FormData();
  form.append('requestId', requestId);
  if (Platform.OS === 'web') {
    const blob = await (await fetch(photo.uri)).blob();
    form.append('photo', blob, photo.name);
  } else {
    form.append('photo', photo as unknown as Blob);
  }
  return apiPost<FurnitureJob>('/me/furniture-generations', form);
}
