/**
 * 가구 거래소 (#1427) — react-query (AGENTS.md 서버 상태 규칙).
 *
 * - 목록·내 주문은 offset 무한 쿼리, 상세는 종목·최근 체결 두 쿼리.
 * - 주문·취소는 **202 접수 → 접수 결과 폴링**. 버튼을 누를 때마다 새 requestId를 만들고,
 *   네트워크 재시도에만 같은 값을 다시 보낸다(서버가 기존 접수를 돌려줘 두 번 주문되지 않는다).
 * - 결과가 나오면(체결·대기·거절·폴링 시간 초과 모두) 지갑·인벤토리·내 방·거래소 캐시를
 *   무효화한다 — 접수하는 순간 코인 차감·인벤토리 숨김(에스크로)이 이미 일어났다.
 *
 * 돌려주는 객체와 함수는 참조가 고정된다(#539) — `useMutation` 객체 대신 `mutateAsync`만
 * 꺼내 쓰고, 최신 콜백은 ref로 읽는다.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { getSessionUserId } from '@/api/auth';
import { ErrorCode } from '@/api/error-codes';
import { ApiError } from '@/api/http';
import {
  cancelMarketOrder,
  fetchMarketAsset,
  fetchMarketAssets,
  fetchMarketCommand,
  fetchMarketTrades,
  fetchMyMarketOrders,
  issueMarketAsset,
  type MarketAsset,
  type MarketAssetCard,
  type MarketCommand,
  type MarketOrder,
  type MarketOrdersFilter,
  placeMarketOrder,
} from '@/api/market';
import type { Page } from '@/api/client';
import type { MarketSide, MarketSource } from '@/api/types';
import {
  MARKET_NETWORK_RETRIES,
  MARKET_PAGE_SIZE,
  MARKET_POLL_INTERVAL_MS,
  MARKET_POLL_TRIES,
  MARKET_TRADES_SIZE,
} from '@/constants/market';
import { useLatestRef } from '@/hooks/use-stable-value';
import { i18n } from '@/i18n';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import { newRequestId } from '@/utils/uuid';

const NO_CARDS: MarketAssetCard[] = [];
const NO_ORDERS: MarketOrder[] = [];

type Pages<T> = { pages: Page<T>[]; pageParams: number[] };

/** 무한 쿼리 페이지 → 한 목록. 새로고침 경계에서 겹친 항목은 한 번만. */
function flatten<T>(data: Pages<T>, idOf: (item: T) => number): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      const id = idOf(item);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  }
  return out;
}
const selectCards = (data: Pages<MarketAssetCard>) => flatten(data, (c) => c.assetId);
const selectOrders = (data: Pages<MarketOrder>) => flatten(data, (o) => o.orderId);

// --- 결과 문구 ----------------------------------------------------------------

/** 즉시 응답(4xx)의 코드 → 안내 문구. 모르는 코드는 일반 문구. */
export function marketErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code && i18n.exists(`market.error.${err.code}`)) {
    return i18n.t(`market.error.${err.code}`);
  }
  return i18n.t('market.error.generic');
}

/** 엔진 거절(`rejectCode`) → 안내 문구. UNREFUNDED만 고객센터 안내. */
export function marketRejectMessage(code: string | null): string {
  if (code && i18n.exists(`market.reject.${code}`)) return i18n.t(`market.reject.${code}`);
  return i18n.t('market.reject.generic');
}

/** 네트워크 끊김·5xx — 같은 requestId로 다시 보내도 안전한 실패. 4xx는 재시도하지 않는다. */
function isRetryable(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status >= 500;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type MarketPollOptions = {
  intervalMs?: number;
  tries?: number;
  /** 테스트가 기다림 없이 돌도록 주입한다. */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * 접수 결과가 PENDING을 벗어날 때까지 짧게 폴링한다. 끝까지 PENDING이면 마지막 상태를
 * 그대로 돌려준다(호출부가 "처리 중" 안내). 조회 실패는 한 번 더 기다렸다 다시 본다.
 */
export async function pollMarketCommand(
  initial: MarketCommand,
  {
    intervalMs = MARKET_POLL_INTERVAL_MS,
    tries = MARKET_POLL_TRIES,
    sleep = defaultSleep,
  }: MarketPollOptions = {},
): Promise<MarketCommand> {
  let current = initial;
  for (let i = 0; i < tries && current.status === 'PENDING'; i += 1) {
    await sleep(intervalMs);
    try {
      current = await fetchMarketCommand(initial.commandId);
    } catch {
      // 일시 실패 — 다음 차례에 다시 본다. 끝까지 못 보면 PENDING으로 접는다.
    }
  }
  return current;
}

/** 같은 requestId로 네트워크 실패만 재시도한다. */
async function sendWithRetry<T>(
  requestId: string,
  send: (requestId: string) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MARKET_NETWORK_RETRIES; attempt += 1) {
    try {
      return await send(requestId);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) break;
    }
  }
  throw lastErr;
}

// --- 조회 훅 ------------------------------------------------------------------

/** 거래소 종목 목록 (GET /market/assets). `enabled=false`면 요청하지 않는다. */
export function useMarketAssets({ enabled = true }: { enabled?: boolean } = {}) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const queryKey = useMemo(() => queryKeys.market.assets(userId), [userId]);
  const {
    data,
    isPending,
    isError,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchMarketAssets({ page: pageParam, size: MARKET_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastParam) => (last.hasNext ? lastParam + 1 : undefined),
    select: selectCards,
    enabled,
  });

  /** 새로고침 — 이어 붙인 페이지는 버리고 첫 장만 다시 받는다. */
  const refresh = useCallback(async () => {
    qc.setQueryData<Pages<MarketAssetCard>>(queryKey, (prev) =>
      prev && prev.pages.length > 1
        ? { pages: prev.pages.slice(0, 1), pageParams: prev.pageParams.slice(0, 1) }
        : prev,
    );
    await refetch();
  }, [qc, queryKey, refetch]);

  const busyRef = useLatestRef(isFetching);
  const hasNextRef = useLatestRef(hasNextPage);
  const loadMore = useCallback(() => {
    if (busyRef.current || !hasNextRef.current) return;
    void fetchNextPage().catch(() => {});
  }, [busyRef, hasNextRef, fetchNextPage]);

  const assets = data ?? NO_CARDS;
  return useMemo(
    () => ({
      assets,
      loading: enabled && isPending,
      error: isError && !isFetchNextPageError && assets.length === 0,
      hasNext: hasNextPage,
      loadingMore: isFetchingNextPage,
      refresh,
      loadMore,
    }),
    [
      assets,
      enabled,
      isPending,
      isError,
      isFetchNextPageError,
      hasNextPage,
      isFetchingNextPage,
      refresh,
      loadMore,
    ],
  );
}

/** 종목 상세 + 최근 체결 첫 페이지. assetId가 null이면 요청하지 않는다. */
export function useMarketAsset(assetId: number | null) {
  const userId = getSessionUserId();
  const enabled = assetId != null;
  const assetQuery = useQuery({
    queryKey: queryKeys.market.asset(userId, assetId),
    queryFn: () => fetchMarketAsset(assetId as number),
    enabled,
  });
  const tradesQuery = useQuery({
    queryKey: queryKeys.market.trades(userId, assetId),
    queryFn: () => fetchMarketTrades(assetId as number, { size: MARKET_TRADES_SIZE }),
    enabled,
  });
  const { refetch: refetchAsset } = assetQuery;
  const { refetch: refetchTrades } = tradesQuery;
  const retry = useCallback(async () => {
    await Promise.all([refetchAsset(), refetchTrades()]);
  }, [refetchAsset, refetchTrades]);

  const asset: MarketAsset | null = assetQuery.data ?? null;
  const trades = tradesQuery.data?.items;
  const loading = enabled && assetQuery.isPending;
  const error = assetQuery.isError && !assetQuery.isFetching;
  return useMemo(
    () => ({ asset, trades: trades ?? [], loading, error, retry }),
    [asset, trades, loading, error, retry],
  );
}

/** 내 주문 (GET /me/market/orders?status=). */
export function useMyMarketOrders(
  status: MarketOrdersFilter,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const userId = getSessionUserId();
  const queryKey = useMemo(() => queryKeys.market.orders(userId, status), [userId, status]);
  const {
    data,
    isPending,
    isError,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchMyMarketOrders({ status, page: pageParam, size: MARKET_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastParam) => (last.hasNext ? lastParam + 1 : undefined),
    select: selectOrders,
    enabled,
  });
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const busyRef = useLatestRef(isFetching);
  const hasNextRef = useLatestRef(hasNextPage);
  const loadMore = useCallback(() => {
    if (busyRef.current || !hasNextRef.current) return;
    void fetchNextPage().catch(() => {});
  }, [busyRef, hasNextRef, fetchNextPage]);

  const orders = data ?? NO_ORDERS;
  return useMemo(
    () => ({
      orders,
      loading: enabled && isPending,
      error: isError && !isFetchNextPageError && orders.length === 0,
      hasNext: hasNextPage,
      loadingMore: isFetchingNextPage,
      refresh,
      loadMore,
    }),
    [
      orders,
      enabled,
      isPending,
      isError,
      isFetchNextPageError,
      hasNextPage,
      isFetchingNextPage,
      refresh,
      loadMore,
    ],
  );
}

// --- 쓰기 ---------------------------------------------------------------------

export type MarketOrderInput = {
  assetId: number;
  side: MarketSide;
  /** SELL만 — INVENTORY(내 보유분) / ISSUANCE(발행 재고). */
  source?: MarketSource;
  price: number;
  quantity: number;
};

/**
 * 주문 결과. `accepted`는 접수(202)를 확인했는지. false면 4xx 거절이거나 네트워크 실패다 —
 * 네트워크 실패는 접수됐을 수도 있어서, 같은 내용으로 다시 누르면 같은 requestId를 보낸다.
 */
export type MarketOrderOutcome =
  | { accepted: true; result: 'filled' | 'open' | 'cancelled' | 'pending' }
  | { accepted: true; result: 'rejected'; rejectCode: string | null }
  | { accepted: false; result: 'error'; code?: string };

type ToastFn = (message: string, type?: 'error' | 'success') => void;

/**
 * 주문·취소·발행. `toast`로 결과를 알리고, `onWalletChanged`로 셸의 지갑을 다시 받게 한다
 * (지갑은 아직 react-query가 아니다 — use-my-room-data의 useState).
 */
export function useMarketActions({
  toast,
  onWalletChanged,
  poll,
}: {
  toast?: ToastFn;
  onWalletChanged?: () => void | Promise<unknown>;
  poll?: MarketPollOptions;
} = {}) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const toastRef = useLatestRef(toast);
  const walletRef = useLatestRef(onWalletChanged);
  const pollRef = useLatestRef(poll);
  // 접수 여부를 모르는 채 끝난 요청(네트워크·5xx·응답 파싱 실패) — 같은 내용으로 다시 누르면
  // 같은 requestId를 보내 서버 멱등을 탄다. 응답을 잃었을 뿐 접수됐을 수 있어서다.
  const unsettledRef = useRef<{ key: string; requestId: string } | null>(null);
  const requestIdFor = useCallback((key: string) => {
    const prev = unsettledRef.current;
    if (prev && prev.key === key) return prev.requestId;
    const requestId = newRequestId();
    unsettledRef.current = { key, requestId };
    return requestId;
  }, []);
  /** 결과가 확정됐으면(접수 또는 4xx 거절) 다음 누름은 새 요청이다. */
  const settleRequest = useCallback((err?: unknown) => {
    if (err === undefined || !isRetryable(err)) unsettledRef.current = null;
  }, []);

  const { mutateAsync: placeAsync } = useMutation({
    mutationFn: ({ input, requestId }: { input: MarketOrderInput; requestId: string }) =>
      placeMarketOrder({ ...input, requestId }),
  });
  const { mutateAsync: cancelAsync } = useMutation({
    mutationFn: ({ orderId, requestId }: { orderId: number; requestId: string }) =>
      cancelMarketOrder(orderId, requestId),
  });
  const { mutateAsync: issueAsync } = useMutation({
    mutationFn: (input: { userItemId: number; totalSupply: number }) => issueMarketAsset(input),
  });

  /** 에스크로·체결로 바뀐 것 전부 — 지갑·재화 내역·인벤토리·내 방·거래소. */
  const invalidateAfterTrade = useCallback(() => {
    void qc.invalidateQueries({ queryKey: queryKeys.market.all(userId) });
    void qc.invalidateQueries({ queryKey: queryKeys.myItems.all });
    void qc.invalidateQueries({ queryKey: queryKeys.myRoom.all });
    void qc.invalidateQueries({ queryKey: queryKeys.walletHistory(userId) });
    void walletRef.current?.();
  }, [qc, userId, walletRef]);

  /** 접수 이후 공통 — 폴링, 결과 토스트, 무효화. */
  const settle = useCallback(
    async (
      accepted: MarketCommand,
      kind: { side: MarketSide | 'CANCEL'; source?: MarketSource },
    ): Promise<MarketOrderOutcome> => {
      const final = await pollMarketCommand(accepted, pollRef.current);
      invalidateAfterTrade();
      const say = toastRef.current;
      let outcome: MarketOrderOutcome;
      if (final.status === 'REJECTED') {
        say?.(marketRejectMessage(final.rejectCode), 'error');
        outcome = { accepted: true, result: 'rejected', rejectCode: final.rejectCode };
      } else if (final.status === 'PENDING') {
        say?.(i18n.t('market.toast.pending'));
        outcome = { accepted: true, result: 'pending' };
      } else if (kind.side === 'CANCEL') {
        say?.(i18n.t('market.toast.cancelled'), 'success');
        outcome = { accepted: true, result: 'cancelled' };
      } else {
        const filled = final.order?.status === 'FILLED';
        const buy = kind.side === 'BUY';
        say?.(
          i18n.t(
            filled
              ? buy
                ? 'market.toast.buyFilled'
                : 'market.toast.sellFilled'
              : buy
                ? 'market.toast.buyOpen'
                : 'market.toast.sellOpen',
          ),
          filled ? 'success' : undefined,
        );
        outcome = { accepted: true, result: filled ? 'filled' : 'open' };
      }
      track('market_order', {
        side: kind.side,
        source: kind.source ?? 'none',
        result: outcome.result,
        ...(outcome.result === 'rejected' && outcome.rejectCode
          ? { code: outcome.rejectCode }
          : {}),
      });
      return outcome;
    },
    [pollRef, invalidateAfterTrade, toastRef],
  );

  const fail = useCallback(
    (err: unknown, kind: { side: MarketSide | 'CANCEL'; source?: MarketSource }) => {
      toastRef.current?.(marketErrorMessage(err), 'error');
      const code = err instanceof ApiError ? err.code : undefined;
      track('market_order', {
        side: kind.side,
        source: kind.source ?? 'none',
        result: 'error',
        ...(code ? { code } : {}),
      });
      // 거래 정지·없는 종목은 화면이 들고 있는 상세가 낡았다 — 다시 받게 한다.
      if (code === ErrorCode.MARKET_ASSET_SUSPENDED || code === ErrorCode.MARKET_ASSET_NOT_FOUND) {
        void qc.invalidateQueries({ queryKey: queryKeys.market.all(userId) });
      }
      const outcome: MarketOrderOutcome = { accepted: false, result: 'error', code };
      return outcome;
    },
    [toastRef, qc, userId],
  );

  /** 주문 — 버튼 한 번에 한 번 부른다(호출마다 새 requestId). */
  const placeOrder = useCallback(
    async (input: MarketOrderInput): Promise<MarketOrderOutcome> => {
      const kind = { side: input.side, source: input.side === 'SELL' ? input.source : undefined };
      const key = JSON.stringify([
        'order',
        input.assetId,
        input.side,
        input.source ?? null,
        input.price,
        input.quantity,
      ]);
      let accepted: MarketCommand;
      try {
        accepted = await sendWithRetry(requestIdFor(key), (requestId) =>
          placeAsync({ input, requestId }),
        );
      } catch (err) {
        settleRequest(err);
        return fail(err, kind);
      }
      settleRequest();
      return settle(accepted, kind);
    },
    [placeAsync, settle, fail, requestIdFor, settleRequest],
  );

  /** 주문 취소 — 같은 접수·폴링 흐름. */
  const cancelOrder = useCallback(
    async (orderId: number): Promise<MarketOrderOutcome> => {
      const kind = { side: 'CANCEL' as const };
      let accepted: MarketCommand;
      try {
        accepted = await sendWithRetry(
          requestIdFor(JSON.stringify(['cancel', orderId])),
          (requestId) => cancelAsync({ orderId, requestId }),
        );
      } catch (err) {
        settleRequest(err);
        if (err instanceof ApiError && err.code === ErrorCode.MARKET_ORDER_NOT_OPEN) {
          // 이미 끝난 주문 — 목록이 낡았다.
          void qc.invalidateQueries({ queryKey: queryKeys.market.all(userId) });
        }
        return fail(err, kind);
      }
      settleRequest();
      return settle(accepted, kind);
    },
    [cancelAsync, settle, fail, qc, userId, requestIdFor, settleRequest],
  );

  /** 발행 — 성공하면 새 종목 상세(캐시에도 심는다), 실패하면 null. */
  const issueAsset = useCallback(
    async (userItemId: number, totalSupply: number): Promise<MarketAsset | null> => {
      try {
        const asset = await issueAsync({ userItemId, totalSupply });
        qc.setQueryData(queryKeys.market.asset(userId, asset.assetId), asset);
        void qc.invalidateQueries({ queryKey: queryKeys.market.assets(userId) });
        track('market_issue', { total_supply: totalSupply, result: 'ok' });
        toastRef.current?.(i18n.t('market.issue.done'), 'success');
        return asset;
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        // 4xx가 아니면 서버에선 발행됐을 수 있다(응답 유실·파싱 실패) — 목록을 다시 받게 한다.
        if (!(err instanceof ApiError) || err.status >= 500) {
          void qc.invalidateQueries({ queryKey: queryKeys.market.all(userId) });
        }
        track('market_issue', {
          total_supply: totalSupply,
          result: 'error',
          ...(code ? { code } : {}),
        });
        toastRef.current?.(marketErrorMessage(err), 'error');
        return null;
      }
    },
    [issueAsync, qc, userId, toastRef],
  );

  return useMemo(
    () => ({ placeOrder, cancelOrder, issueAsset }),
    [placeOrder, cancelOrder, issueAsset],
  );
}
