import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { MarketOrdersFilter } from '@/api/market';
import type { ReportReason } from '@/api/types';
import { type Screen } from '@/components/app/navigation';
import { MarketAssetScreen, type MarketPlaceOrder } from '@/components/screens/market-asset-screen';
import { MarketOrdersScreen } from '@/components/screens/market-orders-screen';
import { MarketScreen } from '@/components/screens/market-screen';
import { useToast } from '@/components/ui/toast';
import { MARKET_AMEND_ENABLED, MARKET_ENABLED } from '@/constants/market';
import {
  useMarketActions,
  useMarketAsset,
  useMarketAssets,
  useMyMarketOrders,
} from '@/hooks/use-market';
import { useModeration } from '@/hooks/use-moderation';
import { i18n } from '@/i18n';
import { track } from '@/lib/analytics';

/**
 * 가구 거래소 페이지 배선 (#1427) — 서브화면 3종(목록·상세·내 주문), 판매 중 수, 스튜디오
 * 발행을 소유한다(use-feed-pages와 같은 결). 목록은 방 화면 전체 메뉴(≡)에서 여는 독립 화면
 * (#1502 — 예전엔 꾸미기 탭). MARKET_ENABLED가 꺼져 있으면 요청도 화면도 없다 —
 * `openMarket`·`onIssue`가 undefined라 메뉴 항목·버튼이 안 생긴다.
 */
export function useMarketPages({
  nav,
  coinBalance,
  diamondBalance,
}: {
  nav: {
    screen: Screen;
    setScreen: Dispatch<SetStateAction<Screen>>;
    /** 셸의 뒤로가기 — 서브화면 뒤로 버튼이 뒤로 맵(BACK_SCREEN)을 다시 적지 않게 (장부 6번). */
    goBack: () => void;
  };
  coinBalance: number;
  diamondBalance: number;
}) {
  const { screen, setScreen, goBack } = nav;
  const { show: toast } = useToast();

  // 목록은 거래소를 처음 열 때부터 받는다 — 셸에 상주하므로 앱 시작 요청을 늘리지 않게.
  const [listVisited, setListVisited] = useState(false);
  useEffect(() => {
    if (MARKET_ENABLED && screen === 'market') setListVisited(true);
  }, [screen]);
  const list = useMarketAssets({ enabled: MARKET_ENABLED && (listVisited || screen === 'market') });

  // 판매 중 수 — 거래소·내 주문에 있을 때만. 내 주문의 대기 중 탭과 같은 캐시.
  const openOrders = useMyMarketOrders('OPEN', {
    enabled: MARKET_ENABLED && (screen === 'market' || screen === 'marketOrders'),
  });
  const sellingCount = useMemo(
    () => openOrders.orders.filter((o) => o.side === 'SELL' && o.source === 'INVENTORY').length,
    [openOrders.orders],
  );

  const [ordersTab, setOrdersTab] = useState<MarketOrdersFilter>('OPEN');
  const closedOrders = useMyMarketOrders('CLOSED', {
    enabled: MARKET_ENABLED && screen === 'marketOrders' && ordersTab === 'CLOSED',
  });
  const orders = ordersTab === 'OPEN' ? openOrders : closedOrders;

  // 상세는 연 종목 id를 기억한다 — 떠나는 전환(#1094) 동안에도 같은 종목을 그리게 비우지 않는다.
  const [assetId, setAssetId] = useState<number | null>(null);
  const detail = useMarketAsset(MARKET_ENABLED ? assetId : null);

  const actions = useMarketActions({ toast });

  // 가구 신고 (#1428) — 접수 안내만. 숨김은 운영자 검토 뒤 서버가 한다.
  const showError = useCallback((message: string) => toast(message, 'error'), [toast]);
  const { report } = useModeration({ onError: showError });
  const reportAsset = useCallback(
    async (id: number, reason: ReportReason, detail?: string) => {
      const ok = await report({ kind: 'asset', assetId: id }, reason, detail);
      if (ok) toast(i18n.t('member.moderation.toast.reported'), 'success');
      return ok;
    },
    [report, toast],
  );

  useEffect(() => {
    if (!MARKET_ENABLED) return;
    if (screen === 'market') track('market_view', { screen: 'list' });
    if (screen === 'marketAsset') track('market_view', { screen: 'asset' });
    if (screen === 'marketOrders') track('market_view', { screen: 'orders' });
  }, [screen]);

  const openAsset = useCallback(
    (id: number) => {
      setAssetId(id);
      setScreen('marketAsset');
    },
    [setScreen],
  );
  const openOrdersScreen = useCallback(() => setScreen('marketOrders'), [setScreen]);

  /** 전체 메뉴(≡)의 "가구 거래소" (#1502). */
  const openMarket = useCallback(() => setScreen('market'), [setScreen]);

  const placeOrderAction = actions.placeOrder;
  const placeOrder: MarketPlaceOrder = useCallback(
    async (order) => {
      if (assetId == null) return false;
      const outcome = await placeOrderAction({ assetId, ...order });
      return outcome.accepted;
    },
    [assetId, placeOrderAction],
  );

  const issueAction = actions.issueAsset;
  const issue = useCallback(
    async (userItemId: number, totalSupply: number) => {
      const asset = await issueAction(userItemId, totalSupply);
      if (!asset) return false;
      openAsset(asset.assetId);
      return true;
    },
    [issueAction, openAsset],
  );

  const amendAction = actions.amendOrder;
  /** 판매 수량 수정 (서버 #437) — 접수가 받아들여졌으면(체결·대기 등 결과와 무관) 시트를 닫는다. */
  const amend = useCallback(
    async (orderId: number, quantity: number) => {
      const outcome = await amendAction(orderId, quantity);
      return outcome.accepted && outcome.result !== 'rejected';
    },
    [amendAction],
  );

  const cancelAction = actions.cancelOrder;
  const cancel = useCallback(
    async (orderId: number) => {
      await cancelAction(orderId);
    },
    [cancelAction],
  );

  const subScreen = !MARKET_ENABLED ? null : screen === 'market' ? (
    <MarketScreen
      assets={list.assets}
      loading={list.loading}
      loadError={list.error}
      hasNext={list.hasNext}
      loadingMore={list.loadingMore}
      onRetry={() => void list.refresh()}
      onRefresh={list.refresh}
      onLoadMore={list.loadMore}
      onOpenAsset={openAsset}
      onOpenOrders={openOrdersScreen}
      coinBalance={coinBalance}
      diamondBalance={diamondBalance}
      sellingCount={sellingCount}
      onBack={goBack}
    />
  ) : screen === 'marketAsset' ? (
    <MarketAssetScreen
      asset={detail.asset}
      trades={detail.trades}
      loading={detail.loading}
      loadError={detail.error}
      onRetry={() => void detail.retry()}
      onRefresh={detail.retry}
      coinBalance={coinBalance}
      onPlaceOrder={placeOrder}
      onOpenOrders={openOrdersScreen}
      onReport={reportAsset}
      onBack={goBack}
    />
  ) : screen === 'marketOrders' ? (
    <MarketOrdersScreen
      tab={ordersTab}
      onChangeTab={setOrdersTab}
      orders={orders.orders}
      loading={orders.loading}
      loadError={orders.error}
      hasNext={orders.hasNext}
      loadingMore={orders.loadingMore}
      onRetry={() => void orders.refresh()}
      onRefresh={orders.refresh}
      onLoadMore={orders.loadMore}
      onCancel={cancel}
      onAmend={MARKET_AMEND_ENABLED ? amend : undefined}
      onOpenAsset={openAsset}
      onBack={goBack}
    />
  ) : null;

  return {
    /** 전체 메뉴(≡)의 "가구 거래소" — 꺼져 있으면 undefined(항목이 안 생긴다). */
    openMarket: MARKET_ENABLED ? openMarket : undefined,
    /** 스튜디오 "거래소에 올리기" — 꺼져 있으면 undefined(버튼이 안 생긴다). */
    onIssue: MARKET_ENABLED ? issue : undefined,
    openAsset,
    /** 내 주문 — 거래소 체결 알림의 목적지 (서버 #432). */
    openOrders: openOrdersScreen,
    subScreen,
  };
}
