/**
 * 거래소 금액 계산 (#1427) — 순수 함수. spec `domains/market/features.md` "로열티와 수수료".
 */
import type { MarketAsset } from '@/api/market';
import type { MarketSide } from '@/api/types';
import {
  MARKET_FEE_PERCENT,
  MARKET_PRICE_MAX,
  MARKET_PRICE_MIN,
  MARKET_ROYALTY_PERCENT,
} from '@/constants/market';

const percentFloor = (amount: number, percent: number) => Math.floor((amount * percent) / 100);

/**
 * 판매 예상 수령액. 체결 금액에서 로열티 10%·수수료 5%를 **각각 내림**해 뗀다
 * (spec 예: 30 → 로열티 3, 소각 1, 판매자 26). 판매자가 제작자이거나 제작자가 탈퇴했으면
 * 로열티는 0.
 *
 * 여러 개(발행 재고) 판매는 **1개씩 계산해 곱한다** — 구매 주문은 항상 1개라(spec "그 밖의
 * 매수·매도 주문은 항상 1개") 발행 재고 N개는 N건의 체결로 각각 정산되고, 내림도 체결마다
 * 일어난다. 합계에 한 번 내림하면 실제보다 많게 보일 수 있다(예: 7×3=21 → 수수료 1 vs 0×3).
 * 체결가는 먼저 걸린 주문 가격이라 내가 부른 값보다 높게 체결될 수는 있어도 낮지는 않다 —
 * 그래서 이 값은 "최소" 예상액이다.
 */
export function expectedProceeds({
  price,
  quantity = 1,
  royaltyFree,
}: {
  price: number;
  quantity?: number;
  royaltyFree: boolean;
}): number {
  if (!Number.isInteger(price) || price <= 0 || quantity <= 0) return 0;
  const royalty = royaltyFree ? 0 : percentFloor(price, MARKET_ROYALTY_PERCENT);
  const fee = percentFloor(price, MARKET_FEE_PERCENT);
  return (price - royalty - fee) * quantity;
}

/** 로열티 면제 — 내가 제작자이거나 제작자가 탈퇴(닉네임 null)했을 때. */
export function isRoyaltyFree(asset: Pick<MarketAsset, 'isCreator' | 'creatorNickname'>): boolean {
  return asset.isCreator || asset.creatorNickname == null;
}

/**
 * 가격 입력 초깃값 — 구매는 최저 판매가(없으면 최근 체결가), 판매는 최근 체결가(없으면
 * 최저 판매가). 둘 다 없으면 빈칸(추측한 값을 채우지 않는다).
 */
export function defaultOrderPrice(
  side: MarketSide,
  asset: Pick<MarketAsset, 'bestAskPrice' | 'lastTradePrice'>,
): number | null {
  return side === 'BUY'
    ? (asset.bestAskPrice ?? asset.lastTradePrice)
    : (asset.lastTradePrice ?? asset.bestAskPrice);
}

/** 입력 문자열 → 유효한 가격(1~1,000 정수) 또는 null. 숫자 외 문자는 거절한다. */
export function parseOrderPrice(text: string): number | null {
  const trimmed = text.replace(/,/g, '').trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= MARKET_PRICE_MIN && n <= MARKET_PRICE_MAX ? n : null;
}

/** 만료까지 남은 시간 → 문구 키와 값. 지났으면 'soon'(만료 처리 직전). */
export function expiryLabel(
  expiresAt: string | null,
  now: Date,
): { key: 'days' | 'hours' | 'soon'; n: number } | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return { key: 'days', n: Math.floor(hours / 24) };
  if (hours >= 1) return { key: 'hours', n: hours };
  return { key: 'soon', n: 0 };
}
