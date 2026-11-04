import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';

import type { ReportReason } from '@/api/types';
import { ApiError } from '@/api/http';
import { type Screen } from '@/components/app/navigation';
import {
  FixedPriceMarketScreen,
  FixedPriceListingScreen,
} from '@/components/screens/fixed-price-market-screen';
import { useToast } from '@/components/ui/toast';
import { MARKET_ENABLED } from '@/constants/market';
import { useMarketShop } from '@/hooks/use-market-shop';
import { useModeration } from '@/hooks/use-moderation';
import { i18n } from '@/i18n';

// 고정가 거래소. 제작자 판매 관리와 표시 가격 구매만 제공함.
export function useMarketPages({
  nav,
  coinBalance,
  diamondBalance,
}: {
  nav: { screen: Screen; setScreen: Dispatch<SetStateAction<Screen>>; goBack: () => void };
  coinBalance: number;
  diamondBalance: number;
  onOpenGuide?: () => void;
}) {
  const { screen, setScreen, goBack } = nav;
  const { show: toast } = useToast();
  const [mine, setMine] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = useRef(false);
  const active = screen === 'market' || screen === 'marketAsset' || screen === 'marketOrders';
  const shop = useMarketShop(
    MARKET_ENABLED && active,
    mine || screen === 'marketOrders',
    selectedId,
  );
  const { report } = useModeration();
  const openAsset = useCallback(
    (id: number) => {
      setSelectedId(id);
      setActionError(null);
      setScreen('marketAsset');
    },
    [setScreen],
  );
  const openMarket = useCallback(() => {
    setMine(false);
    setScreen('market');
  }, [setScreen]);
  const openOrders = useCallback(() => {
    setMine(true);
    setScreen('market');
  }, [setScreen]);
  const fail = useCallback(
    (error: unknown) => {
      const key = error instanceof ApiError && error.code ? `market.error.${error.code}` : '';
      const message = key && i18n.exists(key) ? i18n.t(key) : i18n.t('market.error.generic');
      setActionError(message);
      toast(message, 'error');
    },
    [toast],
  );
  const sell = shop.sell,
    buy = shop.buy,
    update = shop.update;
  const onIssue = useCallback(
    async (userItemId: number, price: number) => {
      if (busy.current) return false;
      busy.current = true;
      setActionError(null);
      try {
        const listing = await sell(userItemId, price);
        openAsset(listing.assetId);
        return true;
      } catch (error) {
        fail(error);
        return false;
      } finally {
        busy.current = false;
      }
    },
    [sell, openAsset, fail],
  );
  const onBuy = useCallback(
    async (price: number) => {
      if (selectedId == null || busy.current) return false;
      busy.current = true;
      setActionError(null);
      try {
        await buy(selectedId, price);
        toast(i18n.t('market.toast.buyFilled'), 'success');
        return true;
      } catch (error) {
        fail(error);
        return false;
      } finally {
        busy.current = false;
      }
    },
    [selectedId, buy, toast, fail],
  );
  const onUpdate = useCallback(
    async (price: number, selling: boolean) => {
      if (selectedId == null || busy.current) return false;
      busy.current = true;
      setActionError(null);
      try {
        await update(selectedId, price, selling);
        return true;
      } catch (error) {
        fail(error);
        return false;
      } finally {
        busy.current = false;
      }
    },
    [selectedId, update, fail],
  );
  const reportAsset = useCallback(
    async (id: number, reason: ReportReason, detail?: string) => {
      const ok = await report({ kind: 'asset', assetId: id }, reason, detail);
      if (ok) toast(i18n.t('member.moderation.toast.reported'), 'success');
      return ok;
    },
    [report, toast],
  );
  const subScreen = !MARKET_ENABLED ? null : screen === 'marketAsset' ? (
    <FixedPriceListingScreen
      key={selectedId}
      listing={shop.listing}
      loading={shop.detailLoading}
      error={shop.detailError}
      actionError={actionError}
      coinBalance={coinBalance}
      onRefresh={shop.refreshDetail}
      onBuy={onBuy}
      onUpdate={onUpdate}
      onReport={reportAsset}
      onBack={goBack}
    />
  ) : screen === 'market' || screen === 'marketOrders' ? (
    <FixedPriceMarketScreen
      listings={shop.listings}
      loading={shop.loading}
      error={shop.error}
      hasNext={shop.hasNext}
      loadingMore={shop.loadingMore}
      mine={mine || screen === 'marketOrders'}
      onToggleMine={() => {
        setMine((v) => !v);
        setScreen('market');
      }}
      coinBalance={coinBalance}
      diamondBalance={diamondBalance}
      onRefresh={shop.refresh}
      onLoadMore={shop.loadMore}
      onOpen={openAsset}
      onBack={goBack}
    />
  ) : null;
  return {
    openMarket: MARKET_ENABLED ? openMarket : undefined,
    onIssue: MARKET_ENABLED ? onIssue : undefined,
    openAsset,
    openOrders,
    subScreen,
  };
}
