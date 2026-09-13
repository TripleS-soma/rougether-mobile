import type { FurnitureItem } from '@/resources/furniture';

export const STARTER_SPEAKER_KEY = 'items/starter/furniture/starter-speaker-v1.webp';
export const SPEAKER_IMAGE = require('@/assets/images/furniture/starter-speaker-v1.webp');
export const isSpeakerFurniture = (item: Pick<FurnitureItem, 'assetKey'>) =>
  item.assetKey === STARTER_SPEAKER_KEY;
export const SPEAKER_TRACKS = [
  { id: 'fire', name: '모닥불', source: require('@/assets/audio/speaker/fire-loop.wav') },
  {
    id: 'rain',
    name: '창밖의 빗소리',
    source: require('@/assets/audio/speaker/rain-loop.wav'),
  },
  {
    id: 'forest',
    name: '숲의 분위기',
    source: require('@/assets/audio/speaker/forest-loop.wav'),
  },
  {
    id: 'piano',
    name: '조용한 피아노',
    source: require('@/assets/audio/speaker/piano-loop.wav'),
  },
] as const;
export type SpeakerTrackId = (typeof SPEAKER_TRACKS)[number]['id'];
export const isSpeakerTrackId = (value: unknown): value is SpeakerTrackId =>
  SPEAKER_TRACKS.some((t) => t.id === value);
export const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.35;
