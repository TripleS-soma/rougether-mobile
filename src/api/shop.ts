/** Shop (items) + gacha endpoints. */
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

/** GET /gacha?catalog=category — decoration categories; the default remains legacy. */
export function fetchGachas() {
  return apiGetList<GachaResponse>('/gacha?catalog=category');
}

/** POST /gacha/{id}/draw — draw `count` times. */
export function drawGacha(id: number, count: GachaDrawCount) {
  return apiPost<GachaDrawResponse>(`/gacha/${id}/draw`, { count });
}

/** GET /gacha/{id}/rewards — 활성 풀의 보상 목록(이름·등급·보유, 확률 비노출) (#620). */
export function fetchGachaRewards(id: number) {
  return apiGetList<GachaRewardResponse>(`/gacha/${id}/rewards`);
}
