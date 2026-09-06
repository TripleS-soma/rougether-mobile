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
 */
const BLOCKED_CODE_PREFIX = 'character';

export function isDrawableGacha(machine: GachaMachine): boolean {
  // Preserve this legacy predicate's contract; category selection rejects unknowns.
  return !machine.code?.startsWith(BLOCKED_CODE_PREFIX);
}
