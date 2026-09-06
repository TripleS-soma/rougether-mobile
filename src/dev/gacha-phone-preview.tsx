import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import type { DrawResult, GachaDrawCount, GachaRewardResponse } from '@/api';
import type { GachaMachine } from '@/api/adapters';
import type { GachaCategory } from '@/api/types';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { Button } from '@/components/ui/button';
import { GACHA_CATEGORIES, GACHA_CATEGORY_META } from '@/constants/gacha';

type DemoRarity = '일반' | '희귀' | '전설';

/** These are catalog keys already used by the room renderer and dev gallery. */
const DEMO_REWARDS: Record<GachaCategory, DrawResult[]> = {
  WALLPAPER: [
    {
      rewardType: 'ITEM',
      itemId: 9101,
      name: '숲의 현자 벽지',
      assetKey: 'items/forest-sage/wallpaper/forest-sage-wallpaper-basic-1205x964.webp',
      converted: false,
    },
    {
      rewardType: 'ITEM',
      itemId: 9102,
      name: '야자수와 조개 벽지',
      assetKey:
        'items/summer-beach-room-v2/wallpaper/summer-beach-room-v2-subtle-palm-shell-wallpaper-1205x585.png',
      converted: false,
    },
  ],
  FLOOR: [
    {
      rewardType: 'ITEM',
      itemId: 9201,
      name: '숲의 현자 바닥',
      assetKey: 'items/forest-sage/floor/forest-sage-floor-1205x482.webp',
      converted: false,
    },
    {
      rewardType: 'ITEM',
      itemId: 9202,
      name: '밝은 모래빛 나무 바닥',
      assetKey:
        'items/summer-beach-room-v2/wallpaper/summer-beach-room-v2-light-sand-wood-floor-1205x584.png',
      converted: false,
    },
  ],
  FURNITURE: [
    {
      rewardType: 'ITEM',
      itemId: 9301,
      name: '숲의 현자 침대',
      assetKey: 'items/forest-sage/furniture/forest-sage-bed.png',
      converted: false,
    },
    {
      rewardType: 'ITEM',
      itemId: 9302,
      name: '야자수 바다 창문',
      assetKey:
        'items/summer-beach-room-v2/furniture/summer-beach-room-v2-arched-palm-ocean-window-animated-v1.webp',
      converted: false,
    },
  ],
};

const DEMO_MACHINES: GachaMachine[] = GACHA_CATEGORIES.map((category, index) => ({
  id: 101 + index,
  category,
  code: GACHA_CATEGORY_META[category].code,
  name: GACHA_CATEGORY_META[category].title,
  icon: GACHA_CATEGORY_META[category].icon,
  accent: GACHA_CATEGORY_META[category].accent,
  kind: 'furniture',
  costCurrencyType: 'COIN',
  costAmount: 25,
  drawCount: 1,
}));

function categoryForId(gachaId: number): GachaCategory {
  return DEMO_MACHINES.find((machine) => machine.id === gachaId)?.category ?? 'FURNITURE';
}

function demoDraw(gachaId: number, count: GachaDrawCount, rarity: DemoRarity): DrawResult[] {
  const pool = DEMO_REWARDS[categoryForId(gachaId)];
  if (count === 1) return [{ ...pool[0], rarity }];
  return [
    ...Array.from({ length: 5 }, (_, index) => ({
      ...pool[index % pool.length],
      rarity: index === 4 ? rarity : index < 2 ? '일반' : '희귀',
    })),
    {
      rewardType: 'CURRENCY',
      converted: true,
      refundCurrencyType: 'DIAMOND',
      refundAmount: 3,
    },
  ];
}

function demoRewardList(gachaId: number, rarity: DemoRarity): GachaRewardResponse[] {
  const category = categoryForId(gachaId);
  return DEMO_REWARDS[category].map((reward, index) => ({
    ...reward,
    rarity: index === 0 ? rarity : '일반',
    owned: index === 1,
    placementType: category === 'FURNITURE' ? 'positioned' : 'surface_slot',
    surfaceSlotType: category === 'FURNITURE' ? undefined : category.toLowerCase(),
  }));
}

/**
 * Dev fixtures only: no request reaches the wallet, draw or inventory APIs.
 * A fullscreen Modal removes gallery chrome; the browser/iframe supplies the
 * real viewport instead of placing a fake phone-sized View around the screen.
 */
export function GachaPhonePreview({
  fullscreen = false,
  rarity = '전설',
  reducedMotion = false,
}: {
  fullscreen?: boolean;
  rarity?: DemoRarity;
  reducedMotion?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const screen = (
    <GachaScreen
      gachas={DEMO_MACHINES}
      coinBalance={5600}
      diamondBalance={120}
      reducedMotion={reducedMotion}
      soundEffectsEnabled
      onBack={fullscreen ? () => setOpen(false) : undefined}
      onDraw={async (gachaId, count) => demoDraw(gachaId, count, rarity)}
      onLoadRewards={async (gachaId) => demoRewardList(gachaId, rarity)}
      placeableItemIds={Object.values(DEMO_REWARDS).flatMap((pool) =>
        pool.map((reward) => String(reward.itemId)),
      )}
      onGoPlace={() => undefined}
    />
  );

  if (!fullscreen) return <View style={styles.galleryPreview}>{screen}</View>;
  return (
    <>
      <Button label="휴대폰 화면 미리보기" onPress={() => setOpen(true)} />
      <Modal visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}>
          <View style={styles.fullscreen}>{screen}</View>
        </SafeAreaInsetsContext.Provider>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1 },
  galleryPreview: { height: 760, alignSelf: 'stretch' },
});
