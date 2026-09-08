import type { GachaMachine } from '@/api/adapters';
import type { GachaCategory } from '@/api/types';
import type { PictogramName } from '@/components/ui/pictograms';
import { GachaAccents } from '@/constants/theme';

export const GACHA_CATEGORIES = ['WALLPAPER', 'FLOOR', 'FURNITURE'] as const;

/** Category identity must not change with server list order or room theme. */
export const GACHA_CATEGORY_META: Record<
  GachaCategory,
  { code: string; title: string; label: string; icon: PictogramName; accent: string }
> = {
  WALLPAPER: {
    code: 'wallpaper_gacha',
    title: '벽지 뽑기',
    label: '벽지',
    icon: 'palette',
    accent: GachaAccents[3],
  },
  FLOOR: {
    code: 'floor_gacha',
    title: '바닥 뽑기',
    label: '바닥',
    icon: 'house',
    accent: GachaAccents[1],
  },
  FURNITURE: {
    code: 'furniture_gacha',
    title: '가구 뽑기',
    label: '가구',
    icon: 'gift',
    accent: GachaAccents[2],
  },
};

/** Only explicit categories or the three canonical server codes identify a box. */
export function getGachaCategory(machine: {
  category?: unknown;
  code?: string;
}): GachaCategory | undefined {
  if (machine.category != null) {
    return GACHA_CATEGORIES.find((category) => category === machine.category);
  }
  return GACHA_CATEGORIES.find((category) => GACHA_CATEGORY_META[category].code === machine.code);
}

/** Keep actual IDs, prices and pool identity; legacy themed boxes cannot be merged. */
export function getCategoryGachas(machines: readonly GachaMachine[]): GachaMachine[] {
  return GACHA_CATEGORIES.flatMap((category) => {
    const machine = machines.find(
      (candidate) =>
        candidate.id > 0 &&
        Number.isInteger(candidate.id) &&
        isDrawableGacha(candidate) &&
        getGachaCategory(candidate) === category,
    );
    return machine ? [machine] : [];
  });
}

/**
 * Legacy visibility guard (#983): character switching (#637) and accessory
 * equipment (#618) are unavailable. Category selection is stricter and uses
 * getCategoryGachas; recognizing an old themed box here does not make it a
 * category machine.
 *
 * 왜 `active` 필터와 별개로 남기나 — 2026-08-26 서버 실측에서 차단 대상인
 * `character_gacha`·`character_accessories_accessories`도 **`active: true`로
 * 내려왔다.** 그래서 #1124의 active 필터는 이 가드를 대체하지 못한다(중복이
 * 아니다). 방 테마 12종은 `bakery_morning`·`calm_hanok`처럼 테마 이름이라
 * 접두 `character`로만 거른다. 되돌리는 시점: #637을 켜거나 #618이 풀릴 때,
 * 또는 서버가 `active: false`로 내려주기 시작할 때.
 */
const BLOCKED_CODE_PREFIX = 'character';

export function isDrawableGacha(machine: GachaMachine): boolean {
  // Preserve this legacy predicate's contract; category selection rejects unknowns.
  return !machine.code?.startsWith(BLOCKED_CODE_PREFIX);
}
