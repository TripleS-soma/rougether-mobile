/** Shop (items) + gacha endpoints. */
import { CHRISTMAS_GACHA_CODE } from '@/constants/gacha';

import { apiGetList, apiPost } from './client';
import type {
  GachaDrawResponse,
  GachaResponse,
  GachaRewardResponse,
  ItemResponse,
  PurchaseResponse,
} from './types';

export type GachaDrawCount = 1 | 6;

/** GET /items — shop catalogue with ownership + price. */
export function fetchItems() {
  return apiGetList<ItemResponse>('/items');
}

/** POST /items/{itemId}/purchase. */
export function purchaseItem(itemId: number) {
  // 409 `SHOP_INSUFFICIENT_BALANCE`는 호출부가 "다이아 부족"으로 접는 예상 상태.
  return apiPost<PurchaseResponse>(`/items/${itemId}/purchase`, undefined, {
    expectedStatuses: [409],
  });
}

/** 캐릭터 전용 머신의 서버 코드 (spec gacha/api "캐릭터 뽑기"). */
export const CHARACTER_GACHA_CODE = 'character_gacha';

/**
 * Category boxes plus exact legacy codes for character and Christmas machines.
 * Christmas is returned only while available on the server. A failed legacy request
 * keeps the ordinary category boxes usable and never invents an event machine.
 */
export async function fetchGachas() {
  const [categories, legacy] = await Promise.all([
    apiGetList<GachaResponse>('/gacha?catalog=category'),
    apiGetList<GachaResponse>('/gacha').catch(() => [] as GachaResponse[]),
  ]);
  return [
    ...categories,
    ...legacy.filter(
      (g) =>
        g.active !== false && (g.code === CHARACTER_GACHA_CODE || g.code === CHRISTMAS_GACHA_CODE),
    ),
  ];
}

/** POST /gacha/{id}/draw — draw `count` times. */
export function drawGacha(id: number, count: GachaDrawCount) {
  return apiPost<GachaDrawResponse>(`/gacha/${id}/draw`, { count });
}

/** GET /gacha/{id}/rewards — 활성 풀의 보상 목록(이름·등급·보유, 확률 비노출) (#620). */
export function fetchGachaRewards(id: number) {
  return apiGetList<GachaRewardResponse>(`/gacha/${id}/rewards`);
}
