/**
 * Character metadata, ported from the prototype `character.ts`. Each character
 * has 4 static pose frames (assets/images/characters/<id>-1..4.webp, wired
 * through CharacterAvatar; 나의 방 cycles poses on tap, elsewhere pose 0); the
 * Pure data — the avatar component supplies its own fallback mark. Pure data — reusable
 * across onboarding, room, etc.
 */
import { i18n } from '@/i18n';

export type CharacterId =
  'cat' | 'dog' | 'tiger' | 'panda' | 'bear' | 'sheep' | 'horse' | 'otter' | 'moru';

export type CharacterOption = {
  id: CharacterId;
  name: string;
  description: string;
  /** Fallback glyph used where the animated sprite isn't rendered. */
  bg: string;
  /** Earned through room growth; unavailable as a free onboarding choice. */
  rewardLevel?: number;
};

/**
 * 이름·설명은 i18n (#893) — 접근 시점에 `i18n.t()`를 부르는 getter라 언어를 바꾸면
 * 다음 렌더부터 새 언어로 읽힌다(모듈 로드 때 한 번 굳히면 언어 변경이 반영되지 않는다).
 */
function localized(id: CharacterId, bg: string, rewardLevel?: number): CharacterOption {
  return {
    id,
    get name() {
      return i18n.t(`member.characters.${id}.name`);
    },
    get description() {
      return i18n.t(`member.characters.${id}.description`);
    },
    bg,
    ...(rewardLevel == null ? {} : { rewardLevel }),
  };
}

export const CHARACTER_OPTIONS: CharacterOption[] = [
  localized('cat', '#F5E6D3'),
  localized('dog', '#E3EEF8'),
  localized('tiger', '#FFF0D8'),
  localized('panda', '#EDEDED'),
  localized('bear', '#F0E4D4'),
  localized('sheep', '#F3EFE8'),
  localized('horse', '#F3E7D6'),
  localized('otter', '#E6E0D6'),
  localized('moru', '#E7F3E9', 5),
];

export const STARTER_CHARACTER_OPTIONS = CHARACTER_OPTIONS.filter((c) => c.rewardLevel == null);

export const DEFAULT_CHARACTER_ID: CharacterId = 'cat';

/**
 * MVP 캐릭터 단일화 — 지금은 고양이만 제공한다. 선택 캐러셀(온보딩)과
 * 캐릭터 교체 진입점을 막는 스위치로, UI 코드는 재사용 예정이라 유지한다.
 * 이미 다른 캐릭터를 쓰는 계정은 그대로 둔다(강제 되돌림 없음).
 */
export const CHARACTER_SELECTION_ENABLED = false;
