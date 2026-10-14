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

/** 캐릭터 전용 머신의 서버 코드 (spec gacha/api "캐릭터 뽑기"). */
export const CHARACTER_GACHA_CODE = 'character_gacha';

/**
 * 뽑기 로비 목록 = 꾸미기 3종(`GET /gacha?catalog=category`) + 캐릭터 머신.
 * 캐릭터 머신은 `category`가 없어 통합 목록에서 빠지므로(spec) 기존 목록 `GET /gacha`에서
 * 코드로 골라 붙인다(2026-10-14 캐릭터 뽑기 재개). 기존 목록이 실패해도 꾸미기 3종은 보여 준다.
 */
export async function fetchGachas() {
  const [categories, legacy] = await Promise.all([
    apiGetList<GachaResponse>('/gacha?catalog=category'),
    apiGetList<GachaResponse>('/gacha').catch(() => [] as GachaResponse[]),
  ]);
  return [...categories, ...legacy.filter((g) => g.code === CHARACTER_GACHA_CODE)];
}

/** POST /gacha/{id}/draw — draw `count` times. */
export function drawGacha(id: number, count: GachaDrawCount) {
  return apiPost<GachaDrawResponse>(`/gacha/${id}/draw`, { count });
}

/** GET /gacha/{id}/rewards — 활성 풀의 보상 목록(이름·등급·보유, 확률 비노출) (#620). */
export function fetchGachaRewards(id: number) {
  return apiGetList<GachaRewardResponse>(`/gacha/${id}/rewards`);
}
