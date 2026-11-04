import type { HouseUpdateRequest } from '@/api/types';

export type HouseDisplayMode = NonNullable<HouseUpdateRequest['displayMode']>;

/** Older servers and unknown future values retain the approved default. */
export function houseDisplayMode(value: unknown): HouseDisplayMode {
  return value === 'CLASSIC' ? 'CLASSIC' : 'DIORAMA';
}
