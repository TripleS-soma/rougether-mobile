/**
 * Character metadata, ported from the prototype `character.ts`. Each character
 * has 4 static pose frames (assets/images/characters/<id>-1..4.webp, wired
 * through CharacterAvatar; 나의 방 cycles poses on tap, elsewhere pose 0); the
 * Pure data — the avatar component supplies its own fallback mark. Pure data — reusable
 * across onboarding, room, etc.
 */
import { i18n } from '@/i18n';

export type CharacterId = 'cat' | 'dog' | 'tiger' | 'panda' | 'bear' | 'sheep' | 'horse' | 'otter';

export type CharacterOption = {
  id: CharacterId;
  name: string;
  description: string;
  /** Fallback glyph used where the animated sprite isn't rendered. */
  bg: string;
};

/**
 * 이름·설명은 i18n (#893) — 접근 시점에 `i18n.t()`를 부르는 getter라 언어를 바꾸면
 * 다음 렌더부터 새 언어로 읽힌다(모듈 로드 때 한 번 굳히면 언어 변경이 반영되지 않는다).
 */
function localized(id: CharacterId, bg: string): CharacterOption {
  return {
    id,
    get name() {
      return i18n.t(`member.characters.${id}.name`);
    },
    get description() {
      return i18n.t(`member.characters.${id}.description`);
    },
    bg,
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
];

/**
 * 온보딩 무료 선택지. 예전엔 레벨 5 보상 모루를 여기서 뺐는데, 모루가 제거돼(2026-10-14)
 * 지금은 전체 목록과 같다 — 호출부 이름은 의도(무료 선택지)를 드러내려 남긴다.
 */
export const STARTER_CHARACTER_OPTIONS = CHARACTER_OPTIONS;

export const DEFAULT_CHARACTER_ID: CharacterId = 'cat';

/**
 * 온보딩 캐릭터 선택 캐러셀 스위치 — 온보딩은 지금도 고양이 하나로 시작한다.
 * 캐릭터 교체·캐릭터 뽑기는 이 스위치가 아니라 **방 레벨 10 해금**(`CHARACTER_UNLOCK_LEVEL`,
 * 서버 `characterUnlocked`)으로 열린다(2026-10-14).
 */
export const CHARACTER_SELECTION_ENABLED = false;

/**
 * 캐릭터 뽑기·교체가 열리는 방 레벨 (2026-10-14 제품 오너 결정, spec room/features).
 * 판정의 정본은 서버 `characterUnlocked`이고, 이 값은 서버 필드가 없을 때의 대체값이다.
 */
export const CHARACTER_UNLOCK_LEVEL = 10;

/**
 * 내 방 응답 → 캐릭터 해금 상태. 서버 `characterUnlocked`가 정본(최고 달성 레벨 기준이라 완료
 * 취소로 레벨이 내려가도 유지)이고, 필드가 없는 옛 서버에선 현재 레벨로 대신 판정한다.
 */
export function characterUnlockOf(room?: {
  growthLevel?: number;
  characterUnlocked?: boolean;
  characterUnlockLevel?: number;
}): { unlocked: boolean; level: number } {
  const level = room?.characterUnlockLevel ?? CHARACTER_UNLOCK_LEVEL;
  return { unlocked: room?.characterUnlocked ?? (room?.growthLevel ?? 0) >= level, level };
}
