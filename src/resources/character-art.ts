import type { CharacterId } from '@/constants/characters';

import catIdle from '@/assets/images/characters/cat-approved-idle.webp';
import catBlink from '@/assets/images/characters/cat-approved-blink.webp';
import catWink from '@/assets/images/characters/cat-approved-wink.webp';
import catSeated from '@/assets/images/characters/cat-approved-seated.webp';
import catWave from '@/assets/images/characters/cat-approved-wave.webp';
import catStretch from '@/assets/images/characters/cat-approved-stretch.webp';
import catSleep from '@/assets/images/characters/cat-approved-sleep.webp';
import catGroom from '@/assets/images/characters/cat-approved-groom.webp';
import catStill from '@/assets/images/characters/cat-approved-still.webp';

/** Reviewed poses supersede legacy server art until a new set is approved. */
const APPROVED_POSES: Partial<Record<CharacterId, readonly number[]>> = {
  cat: [catIdle, catBlink, catWink, catSeated, catWave, catStretch, catSleep, catGroom],
};

export function approvedCharacterPoses(characterId: CharacterId) {
  return APPROVED_POSES[characterId];
}

// Friend-room stills never enter the interactive pose cycle.
export function approvedCharacterStill(characterId: CharacterId) {
  return characterId === 'cat' ? catStill : undefined;
}

/** Base artwork keys also appear in the picker and character gacha results. */
export function approvedCharacterPoster(key?: string) {
  const path = key?.replace(/^\//, '');
  return path && /^characters\/cat(?:\/|[_.-])/.test(path) ? catIdle : undefined;
}
