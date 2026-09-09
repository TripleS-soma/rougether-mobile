import type { CharacterId } from '@/constants/characters';

import catIdle from '@/assets/images/characters/cat-approved-idle.webp';
import catWave from '@/assets/images/characters/cat-approved-wave.webp';

/** Reviewed poses supersede legacy server art until a new set is approved. */
const APPROVED_POSES: Partial<Record<CharacterId, readonly number[]>> = {
  cat: [catIdle, catWave],
};

export function approvedCharacterPoses(characterId: CharacterId) {
  return APPROVED_POSES[characterId];
}

/** Base artwork keys also appear in the picker and character gacha results. */
export function approvedCharacterPoster(key?: string) {
  const path = key?.replace(/^\//, '');
  return path && /^characters\/cat(?:\/|[_.-])/.test(path) ? catIdle : undefined;
}
