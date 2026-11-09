import type { GachaRewardResponse } from '@/api';
import type { GachaSeasonalPresentation } from '@/components/screens/gacha/gacha-lobby';
import { ChristmasRoomHero } from '@/components/screens/gacha/christmas-room-hero';
import { CHRISTMAS_GACHA_CODE } from '@/constants/gacha';
import { GachaAccents } from '@/constants/theme';
import assets from '@/resources/christmas-gacha-assets.json';

/** Visual proposal only: sample price 25 / 125, no released event machine ID. */
export const CHRISTMAS_PREVIEW: GachaSeasonalPresentation = {
  machine: {
    id: 2026,
    code: CHRISTMAS_GACHA_CODE,
    name: '크리스마스',
    icon: 'gift',
    accent: GachaAccents[2],
    kind: 'furniture',
    costCurrencyType: 'COIN',
    costAmount: 25,
    drawCount: 1,
  },
  title: '크리스마스',
  endsLabel: '12.25까지',
  hero: <ChristmasRoomHero />,
};

export const CHRISTMAS_PREVIEW_REWARDS: GachaRewardResponse[] = assets.map((asset, index) => ({
  rewardType: 'ITEM',
  itemId: 9501 + index,
  name: asset.name,
  assetKey: `items/local-christmas-preview/${asset.filename}`,
  rarity: '일반',
  owned: false,
  categoryCode: asset.surface ?? 'furniture',
  placementType: asset.surface ? 'surface_slot' : 'positioned',
  surfaceSlotType: asset.surface ?? undefined,
}));
