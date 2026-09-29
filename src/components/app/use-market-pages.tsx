import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { MarketOrdersFilter } from '@/api/market';
import { type Screen } from '@/components/app/navigation';
import { MarketAssetScreen, type MarketPlaceOrder } from '@/components/screens/market-asset-screen';
import { MarketOrdersScreen } from '@/components/screens/market-orders-screen';
import { MarketList } from '@/components/screens/market/market-list';
import type { DecorLeave } from '@/components/screens/room-decor-screen';
import { useToast } from '@/components/ui/toast';
import { MARKET_ENABLED } from '@/constants/market';
import {
  useMarketActions,
  useMarketAsset,
  useMarketAssets,
  useMyMarketOrders,
} from '@/hooks/use-market';
import { useLatestRef } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';

type ListState = ReturnType<typeof useMarketAssets>;

/** 꾸미기 거래소 탭 — 처음 그려질 때 목록을 받기 시작하고 진입을 센다. */
function MarketTabPanel({
  list,
  onVisible,
  onOpenAsset,
  onOpenOrders,
}: {
  list: ListState;
  onVisible: () => void;
  onOpenAsset: (assetId: number) => void;
  onOpenOrders: () => void;
}) {
  const onVisibleRef = useLatestRef(onVisible);
  useEffect(() => {
    onVisibleRef.current();
    track('market_view', { screen: 'list' });
  }, [onVisibleRef]);
  return (
    <MarketList
      assets={list.assets}
      loading={list.loading}
      loadError={list.error}
      hasNext={list.hasNext}
      loadingMore={list.loadingMore}
      onRetry={() => void list.refresh()}
      onRefresh={() => void list.refresh()}
      onLoadMore={list.loadMore}
      onOpenAsset={onOpenAsset}
      onOpenOrders={onOpenOrders}
    />
  );
}

/**
 * 가구 거래소 페이지 배선 (#1427) — 꾸미기의 거래소 탭 내용·판매 중 수, 서브화면 2종(상세·
 * 내 주문), 스튜디오 발행을 소유한다(use-feed-pages와 같은 결). MARKET_ENABLED가 꺼져
 * 있으면 요청도 화면도 없다 — `renderMarket`·`onIssue`가 undefined라 탭·버튼이 안 생긴다.
 */
export function useMarketPages({
  nav,
  coinBalance,
  onWalletChanged,
  onLeaveDecorFromMarketTab,
}: {
  nav: { screen: Screen; setScreen: Dispatch<SetStateAction<Screen>> };
  coinBalance: number;
  /** 주문 결과가 나오면 셸 지갑을 다시 받는다(지갑은 아직 react-query가 아니다). */
  onWalletChanged?: () => void | Promise<unknown>;
  /** 거래소 탭에서 상세·내 주문으로 나갈 때 — 돌아오면 거래소 탭이 다시 열리게. */
  onLeaveDecorFromMarketTab?: () => void;
}) {
  const { screen, setScreen } = nav;
  const { show: toast } = useToast();

  const [listVisited, setListVisited] = useState(false);
  const markListVisited = useCallback(() => setListVisited(true), []);
  const list = useMarketAssets({ enabled: MARKET_ENABLED && listVisited });

  // 판매 중 수 — 꾸미기·내 주문에 있을 때만. 내 주문의 대기 중 탭과 같은 캐시.
  const decorOpen = screen === 'decor';
  const openOrders = useMyMarketOrders('OPEN', {
    enabled: MARKET_ENABLED && (decorOpen || screen === 'marketOrders'),
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

  const actions = useMarketActions({
    toast,
    onWalletChanged,
  });

  useEffect(() => {
    if (!MARKET_ENABLED) return;
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

  const leaveRef = useLatestRef(onLeaveDecorFromMarketTab);
  const renderMarket = useCallback(
    (leave: DecorLeave) => (
      <MarketTabPanel
        list={list}
        onVisible={markListVisited}
        onOpenAsset={(id) =>
          leave(() => {
            leaveRef.current?.();
            openAsset(id);
          })
        }
        onOpenOrders={() =>
          leave(() => {
            leaveRef.current?.();
            openOrdersScreen();
          })
        }
      />
    ),
    [list, markListVisited, openAsset, openOrdersScreen, leaveRef],
  );

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

  const cancelAction = actions.cancelOrder;
  const cancel = useCallback(
    async (orderId: number) => {
      await cancelAction(orderId);
    },
    [cancelAction],
  );

  const subScreen = !MARKET_ENABLED ? null : screen === 'marketAsset' ? (
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
      // TODO(#1427): 신고 API(서버 #423) 배선 후 onReport를 넘긴다 — 그 전엔 MARKET_ENABLED를 켜지 않는다.
      onBack={() => setScreen('decor')}
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
      onOpenAsset={openAsset}
      onBack={() => setScreen('decor')}
    />
  ) : null;

  return {
    /** 꾸미기의 거래소 탭 — 꺼져 있으면 undefined(탭이 안 생긴다). */
    renderMarket: MARKET_ENABLED ? renderMarket : undefined,
    sellingCount: MARKET_ENABLED ? sellingCount : 0,
    onOpenSelling: MARKET_ENABLED ? openOrdersScreen : undefined,
    /** 스튜디오 "거래소에 올리기" — 꺼져 있으면 undefined(버튼이 안 생긴다). */
    onIssue: MARKET_ENABLED ? issue : undefined,
    openAsset,
    subScreen,
  };
}
