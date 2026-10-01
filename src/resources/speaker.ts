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
// 교차 혼합한 루프 PCM을 AAC 128kbps(m4a, afconvert)로 담는다 (성능 장부 B1) — WAV 36MB → 3.4MB.
// m4a의 인코더 지연(priming) 정보로 디코더가 앞뒤 여백을 잘라 샘플 단위로 원본과 같은 길이가
// 된다(ffmpeg 디코드 실측: 샘플 수 일치·정렬 0). 이음새는 실기기에서 들어 확인할 것.
export const SPEAKER_TRACKS = [
  track('fire', require('@/assets/audio/speaker/fire-loop.m4a')),
  track('rain', require('@/assets/audio/speaker/rain-loop.m4a')),
  track('forest', require('@/assets/audio/speaker/forest-loop.m4a')),
  track('piano', require('@/assets/audio/speaker/piano-loop.m4a')),
] as const;
export type SpeakerTrackId = (typeof SPEAKER_TRACKS)[number]['id'];
export const isSpeakerTrackId = (value: unknown): value is SpeakerTrackId =>
  SPEAKER_TRACKS.some((t) => t.id === value);
export const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.35;
