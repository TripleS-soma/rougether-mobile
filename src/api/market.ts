/**
 * 가구 거래소 (#1427) — spec `domains/market/api.md`. 운영 경로는 `/api/v1/market/...`
 * (`API_BASE`가 `/api/v1`까지 품는다). 목록은 offset 페이지(`{ items, page, size,
 * totalElements }`). 주문·취소는 **202 접수만** 하고, 결과는 접수 결과 조회로 확인한다.
 *
 * 응답 타입(`./types`)은 전부 선택 필드라, 화면이 쓰는 모양은 여기서 한 번 정규화한다.
 */
import { apiGet, apiGetPage, apiPost, type Page } from './client';
import { buildQuery } from './http';
import type {
  AssetCard,
  MarketAssetResponse,
  MarketAssetStatus,
  MarketCommandAcceptedResponse,
  MarketCommandResponse,
  MarketCommandStatus,
  MarketOrderResponse,
  MarketOrderStatus,
  MarketSide,
  MarketSource,
  PlaceOrderRequest,
  PriceLevel,
  TradeItem,
} from './types';

export type MarketAssetCard = {
  assetId: number;
  itemId: number | null;
  name: string;
  assetKey: string | null;
  /** 제작자 탈퇴 시 null. */
  creatorNickname: string | null;
  totalSupply: number;
  /** 최저 판매가 — 판매 대기가 없으면 null. */
  bestAskPrice: number | null;
  askQuantity: number;
  lastTradePrice: number | null;
  status: MarketAssetStatus;
};

export type MarketPriceLevel = { price: number; quantity: number };

export type MarketAsset = MarketAssetCard & {
  isCreator: boolean;
  unissuedQuantity: number;
  /** 인벤토리에 활성 보유 중(판매 등록으로 맡긴 것은 제외). */
  owned: boolean;
  /** 가격 오름차순. */
  asks: MarketPriceLevel[];
  /** 가격 내림차순. */
  bids: MarketPriceLevel[];
};

export type MarketTrade = { tradeId: number; price: number; quantity: number; tradedAt: string };

export type MarketOrder = {
  orderId: number;
  assetId: number;
  name: string;
  assetKey: string | null;
  side: MarketSide;
  source: MarketSource | null;
  price: number;
  quantity: number;
  filledQuantity: number;
  status: MarketOrderStatus;
  expiresAt: string | null;
  createdAt: string | null;
};

export type MarketCommand = {
  commandId: number;
  status: MarketCommandStatus;
  rejectCode: string | null;
  order: MarketOrder | null;
};

export type MarketOrdersFilter = 'OPEN' | 'CLOSED';

// --- 정규화 -------------------------------------------------------------------

const toLevel = (l: PriceLevel): MarketPriceLevel | null =>
  l.price == null ? null : { price: l.price, quantity: l.quantity ?? 0 };

export function toMarketAssetCard(res: AssetCard): MarketAssetCard | null {
  if (res.assetId == null) return null;
  return {
    assetId: res.assetId,
    itemId: res.itemId ?? null,
    name: res.name ?? '',
    assetKey: res.assetKey ?? null,
    creatorNickname: res.creatorNickname ?? null,
    totalSupply: res.totalSupply ?? 0,
    bestAskPrice: res.bestAskPrice ?? null,
    askQuantity: res.askQuantity ?? 0,
    lastTradePrice: res.lastTradePrice ?? null,
    status: res.status ?? 'ACTIVE',
  };
}

export function toMarketAsset(res: MarketAssetResponse): MarketAsset {
  if (res.assetId == null) throw new Error('market asset without id');
  const asks = (res.asks ?? []).map(toLevel).filter((l): l is MarketPriceLevel => l !== null);
  const bids = (res.bids ?? []).map(toLevel).filter((l): l is MarketPriceLevel => l !== null);
  return {
    assetId: res.assetId,
    itemId: res.itemId ?? null,
    name: res.name ?? '',
    assetKey: res.assetKey ?? null,
    creatorNickname: res.creatorNickname ?? null,
    totalSupply: res.totalSupply ?? 0,
    bestAskPrice: asks[0]?.price ?? null,
    askQuantity: asks.reduce((sum, l) => sum + l.quantity, 0),
    lastTradePrice: res.lastTradePrice ?? null,
    status: res.status ?? 'ACTIVE',
    isCreator: res.isCreator ?? false,
    unissuedQuantity: res.unissuedQuantity ?? 0,
    owned: res.owned ?? false,
    asks,
    bids,
  };
}

const toTrade = (t: TradeItem): MarketTrade | null =>
  t.tradeId == null || t.price == null
    ? null
    : { tradeId: t.tradeId, price: t.price, quantity: t.quantity ?? 1, tradedAt: t.tradedAt ?? '' };

export function toMarketOrder(res: MarketOrderResponse | null | undefined): MarketOrder | null {
  if (!res || res.orderId == null || res.assetId == null) return null;
  return {
    orderId: res.orderId,
    assetId: res.assetId,
    name: res.name ?? '',
    assetKey: res.assetKey ?? null,
    side: res.side ?? 'BUY',
    source: res.source ?? null,
    price: res.price ?? 0,
    quantity: res.quantity ?? 1,
    filledQuantity: res.filledQuantity ?? 0,
    status: res.status ?? 'OPEN',
    expiresAt: res.expiresAt ?? null,
    createdAt: res.createdAt ?? null,
  };
}

function toCommand(res: MarketCommandResponse | MarketCommandAcceptedResponse): MarketCommand {
  if (res.commandId == null) throw new Error('market command without id');
  const full = res as MarketCommandResponse;
  return {
    commandId: res.commandId,
    status: res.status ?? 'PENDING',
    rejectCode: full.rejectCode ?? null,
    order: toMarketOrder(full.order),
  };
}

function adaptPage<T, R>(page: Page<T>, adapt: (item: T) => R | null): Page<R> {
  return { ...page, items: page.items.map(adapt).filter((x): x is R => x !== null) };
}

// --- 조회 ---------------------------------------------------------------------

/** GET /market/assets — 거래 중(ACTIVE) 종목, 최근 상장순. */
export async function fetchMarketAssets({
  page = 0,
  size,
}: { page?: number; size?: number } = {}): Promise<Page<MarketAssetCard>> {
  return adaptPage(
    await apiGetPage<AssetCard>(`/market/assets${buildQuery({ page, size })}`),
    toMarketAssetCard,
  );
}

/** GET /market/assets/{assetId} — 상세·호가(각 최대 10단계). 없는 종목은 404. */
export async function fetchMarketAsset(assetId: number): Promise<MarketAsset> {
  return toMarketAsset(
    await apiGet<MarketAssetResponse>(`/market/assets/${assetId}`, { expectedStatuses: [404] }),
  );
}

/** GET /market/assets/{assetId}/trades — 최근 체결, 최신순. */
export async function fetchMarketTrades(
  assetId: number,
  { page = 0, size }: { page?: number; size?: number } = {},
): Promise<Page<MarketTrade>> {
  return adaptPage(
    await apiGetPage<TradeItem>(`/market/assets/${assetId}/trades${buildQuery({ page, size })}`),
    toTrade,
  );
}

/** GET /me/market/orders — OPEN(대기 중) / CLOSED(체결·취소·만료), 최신순. */
export async function fetchMyMarketOrders({
  status,
  page = 0,
  size,
}: {
  status: MarketOrdersFilter;
  page?: number;
  size?: number;
}): Promise<Page<MarketOrder>> {
  return adaptPage(
    await apiGetPage<MarketOrderResponse>(`/me/market/orders${buildQuery({ status, page, size })}`),
    toMarketOrder,
  );
}

/** GET /market/commands/{commandId} — 본인 접수의 처리 결과. */
export async function fetchMarketCommand(commandId: number): Promise<MarketCommand> {
  return toCommand(await apiGet<MarketCommandResponse>(`/market/commands/${commandId}`));
}

// --- 쓰기 ---------------------------------------------------------------------

/** POST /market/assets — 내 AI 가구를 에디션(1~10)으로 발행. 201 → 종목 상세. */
export async function issueMarketAsset(input: {
  userItemId: number;
  totalSupply: number;
}): Promise<MarketAsset> {
  return toMarketAsset(await apiPost<MarketAssetResponse>('/market/assets', input));
}

/**
 * POST /market/orders — 202 접수. BUY는 `source`를 비워 둔다(spec). 같은 `requestId`로
 * 같은 내용을 다시 보내면 기존 접수를 돌려준다(네트워크 재시도 안전).
 */
export async function placeMarketOrder(input: PlaceOrderRequest): Promise<MarketCommand> {
  const body: PlaceOrderRequest = {
    requestId: input.requestId,
    assetId: input.assetId,
    side: input.side,
    price: input.price,
    quantity: input.quantity,
    source: input.side === 'SELL' ? (input.source ?? 'INVENTORY') : null,
  };
  return toCommand(await apiPost<MarketCommandAcceptedResponse>('/market/orders', body));
}

/** POST /market/orders/{orderId}/cancel — 202 접수. 환불은 엔진 처리 때. */
export async function cancelMarketOrder(
  orderId: number,
  requestId: string,
): Promise<MarketCommand> {
  return toCommand(
    await apiPost<MarketCommandAcceptedResponse>(`/market/orders/${orderId}/cancel`, {
      requestId,
    }),
  );
}
