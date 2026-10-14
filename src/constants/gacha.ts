import type { GachaMachine } from '@/api/adapters';
import type { PictogramName } from '@/components/ui/pictograms';
import { GachaAccents } from '@/constants/theme';
import { i18n } from '@/i18n';

/**
 * 뽑기 로비의 상자 4종. 꾸미기 3종은 서버 `category`가 있는 통합 뽑기이고, 캐릭터는 서버
 * `category`가 없는 전용 머신(`character_gacha`, spec gacha/api "캐릭터 뽑기")이라 코드로 찾는다.
 * 캐릭터 뽑기는 방 레벨 10부터 열린다(2026-10-14) — 잠금 판정은 화면이 `characterUnlocked`로 한다.
 */
export const GACHA_CATEGORIES = ['WALLPAPER', 'FLOOR', 'FURNITURE', 'CHARACTER'] as const;
export type LobbyGachaCategory = (typeof GACHA_CATEGORIES)[number];

/**
 * Category identity must not change with server list order or room theme.
 * title·label은 getter — 모듈 로드 시점에 번역하면 언어 변경이 반영되지 않는다 (#893).
 */
export const GACHA_CATEGORY_META: Record<
  LobbyGachaCategory,
  { code: string; title: string; label: string; icon: PictogramName; accent: string }
> = {
  WALLPAPER: {
    code: 'wallpaper_gacha',
    get title() {
      return i18n.t('roomShop.gacha.category.WALLPAPER.title');
    },
    get label() {
      return i18n.t('roomShop.gacha.category.WALLPAPER.label');
    },
    icon: 'palette',
    accent: GachaAccents[3],
  },
  FLOOR: {
    code: 'floor_gacha',
    get title() {
      return i18n.t('roomShop.gacha.category.FLOOR.title');
    },
    get label() {
      return i18n.t('roomShop.gacha.category.FLOOR.label');
    },
    icon: 'house',
    accent: GachaAccents[1],
  },
  FURNITURE: {
    code: 'furniture_gacha',
    get title() {
      return i18n.t('roomShop.gacha.category.FURNITURE.title');
    },
    get label() {
      return i18n.t('roomShop.gacha.category.FURNITURE.label');
    },
    icon: 'gift',
    accent: GachaAccents[2],
  },
  CHARACTER: {
    code: 'character_gacha',
    get title() {
      return i18n.t('roomShop.gacha.category.CHARACTER.title');
    },
    get label() {
      return i18n.t('roomShop.gacha.category.CHARACTER.label');
    },
    icon: 'paw',
    accent: GachaAccents[3],
  },
};

/** Only explicit categories or the three canonical server codes identify a box. */
export function getGachaCategory(machine: {
  category?: unknown;
  code?: string;
}): LobbyGachaCategory | undefined {
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
 * 노출 가드 (#983) — 캐릭터 악세사리 머신(`character_accessories_*`, #618)은 아직 열지 않는다.
 * 캐릭터 뽑기(`character_gacha`)는 2026-10-14 레벨 10 해금으로 다시 열었으므로 막지 않는다.
 *
 * 왜 `active` 필터와 별개로 남기나 — 2026-08-26 서버 실측에서 차단 대상인
 * `character_accessories_accessories`도 **`active: true`로 내려왔다.** 그래서 #1124의 active
 * 필터는 이 가드를 대체하지 못한다. 되돌리는 시점: #618이 풀리거나 서버가 `active: false`로
 * 내려주기 시작할 때.
 */
const BLOCKED_CODE_PREFIX = 'character_accessor';

export function isDrawableGacha(machine: GachaMachine): boolean {
  return !machine.code?.startsWith(BLOCKED_CODE_PREFIX);
}
