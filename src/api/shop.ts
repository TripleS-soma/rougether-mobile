/** Shop (items) + gacha endpoints. */
import { apiGet, apiGetList, apiPost } from './client';
import type { GachaDrawResponse, GachaResponse, ItemResponse, PurchaseResponse } from './types';

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
export function drawGacha(id: number, count: number) {
  return apiPost<GachaDrawResponse>(`/gacha/${id}/draw`, { count });
}
