/** Shop (items) + gacha endpoints. */
import { apiGet, apiGetList, apiPost } from './client';
import type { GachaDrawResponse, GachaResponse, ItemResponse, PurchaseResponse } from './types';

export type GachaDrawCount = 1 | 6;

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

/** POST /gacha/{id}/draw — draw `count` times. */
export function drawGacha(id: number, count: GachaDrawCount) {
  return apiPost<GachaDrawResponse>(`/gacha/${id}/draw`, { count });
}
