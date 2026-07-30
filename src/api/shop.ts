/** Shop (items) + gacha endpoints. */
import { apiGet, apiGetList, apiPost } from './client';
import type { GachaDrawResponse, GachaResponse, ItemResponse, PurchaseResponse } from './types';

export type GachaDrawCount = 1 | 6;

/** Reader model for one `GET /gacha/{id}/rewards` item. */
export type GachaRewardPreview = {
  rewardType: 'ITEM' | 'CHARACTER';
  itemId?: number;
  characterId?: number;
  name: string;
  assetKey: string;
  rarity?: string;
  owned: boolean;
  categoryCode?: string;
  placementType?: string;
  surfaceSlotType?: string;
  characterSlotType?: string;
};

/** GET /items — shop catalogue with ownership + price. */
export function fetchItems() {
  return apiGetList<ItemResponse>('/items');
}

/** POST /items/{itemId}/purchase. */
export function purchaseItem(itemId: number) {
  return apiPost<PurchaseResponse>(`/items/${itemId}/purchase`);
}

/** GET /gacha — available gacha machines. */
export function fetchGachas() {
  return apiGetList<GachaResponse>('/gacha');
}

/** GET /gacha/{id}. */
export function fetchGacha(id: number) {
  return apiGet<GachaResponse>(`/gacha/${id}`);
}

/** GET /gacha/{id}/rewards — active rewards without weight or probability. */
export function fetchGachaRewards(id: number) {
  return apiGetList<GachaRewardPreview>(`/gacha/${id}/rewards`);
}

/** POST /gacha/{id}/draw — draw `count` times. */
export function drawGacha(id: number, count: GachaDrawCount) {
  return apiPost<GachaDrawResponse>(`/gacha/${id}/draw`, { count });
}
