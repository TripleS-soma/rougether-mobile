import type { FurnitureItem } from '@/resources/furniture';
import { i18n } from '@/i18n';

export const STARTER_SPEAKER_KEY = 'items/starter/furniture/starter-speaker-v1.webp';
export const SPEAKER_IMAGE = require('@/assets/images/furniture/starter-speaker-v1.webp');
export const isSpeakerFurniture = (item: Pick<FurnitureItem, 'assetKey'>) =>
  item.assetKey === STARTER_SPEAKER_KEY;
/** 곡 이름은 접근 시점에 읽는 getter (#893) — 모듈 로드 때 굳히면 언어 변경이 반영되지 않는다. */
function track<Id extends string>(id: Id, source: number) {
  return {
    id,
    source,
    get name(): string {
      return i18n.t(`roomShop.speaker.tracks.${id}`);
    },
  };
}
export const SPEAKER_TRACKS = [
  track('fire', require('@/assets/audio/speaker/fire-loop.wav')),
  track('rain', require('@/assets/audio/speaker/rain-loop.wav')),
  track('forest', require('@/assets/audio/speaker/forest-loop.wav')),
  track('piano', require('@/assets/audio/speaker/piano-loop.wav')),
] as const;
export type SpeakerTrackId = (typeof SPEAKER_TRACKS)[number]['id'];
export const isSpeakerTrackId = (value: unknown): value is SpeakerTrackId =>
  SPEAKER_TRACKS.some((t) => t.id === value);
export const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.35;
