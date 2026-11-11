import artAnchors from '@/components/room/character-art-anchors.json';

import type { ImageStyle, ViewStyle } from 'react-native';

import { ROOM_RENDER_CONTRACT, roomPercent } from '@/components/room/room-render-contract';

export const CHARACTER_SCALE_MIN = 0.7;
export const CHARACTER_SCALE_MAX = 1.3;
export const CHARACTER_SCALE_DEFAULT = 1;
export const CHARACTER_SCALE_STEP = 0.01;

export function normalizeCharacterScale(value?: number | null): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(Math.min(CHARACTER_SCALE_MAX, Math.max(CHARACTER_SCALE_MIN, value)) * 100) / 100
    : CHARACTER_SCALE_DEFAULT;
}

/** Both edges move symmetrically; the bottom-center anchor never moves. */
export function characterFrameStyle(value?: number): ViewStyle {
  const width = ROOM_RENDER_CONTRACT.character.width * normalizeCharacterScale(value);
  return {
    left: roomPercent(ROOM_RENDER_CONTRACT.character.centerX - width / 2),
    width: roomPercent(width),
    bottom: roomPercent(ROOM_RENDER_CONTRACT.character.bottom),
    aspectRatio: ROOM_RENDER_CONTRACT.character.aspectRatio,
  };
}

/** Keep visible art centered and its baseline fixed, including transparent source padding.
 * Insets are measured in the square contain frame, not raw source-image percentages.
 * Unknown server art retains the frame anchor until its measurements are registered.
 */
export function characterArtOffset(key: string, value: number): ImageStyle {
  const anchor = (artAnchors as Record<string, { centerOffset: number; bottomInset: number }>)[key];
  if (!anchor) return {};
  const scale = normalizeCharacterScale(value);
  return {
    position: 'relative',
    left: roomPercent(-anchor.centerOffset),
    top: roomPercent((anchor.bottomInset * (scale - 1)) / scale),
  };
}
