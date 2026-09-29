import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MarketOrder, MarketOrdersFilter } from '@/api/market';
import { expiryLabel } from '@/components/screens/market/economics';
import { MarketAssetImage } from '@/components/screens/market/market-asset-image';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loading } from '@/components/ui/loading';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { RetryState } from '@/components/ui/retry-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 행 그림 한 변. */
const ROW_IMAGE = 56;

const TABS: MarketOrdersFilter[] = ['OPEN', 'CLOSED'];
const NO_ORDERS: MarketOrder[] = [];

export type MarketOrdersScreenProps = {
  tab?: MarketOrdersFilter;
  onChangeTab?: (tab: MarketOrdersFilter) => void;
  orders?: MarketOrder[];
  loading?: boolean;
  loadError?: boolean;
  hasNext?: boolean;
  loadingMore?: boolean;
  onRetry?: () => void;
  onRefresh?: () => Promise<unknown> | void;
  onLoadMore?: () => void;
  /** 대기 중 주문 취소 — 확인 다이얼로그를 거친 뒤 부른다. */
  onCancel?: (orderId: number) => Promise<unknown> | void;
  onOpenAsset?: (assetId: number) => void;
  onBack?: () => void;
  /** 만료까지 남은 시간 기준 — 테스트 고정용. */
  now?: Date;
};

/**
 * 내 주문 (#1427) — 대기 중(OPEN) / 완료(체결·취소·만료, CLOSED) 탭. 행: 그림·이름·구매/판매·
 * 가격·체결 수량·상태·만료까지 남은 시간. 대기 중 주문은 확인 후 취소.
 */
export function MarketOrdersScreen({
  tab = 'OPEN',
  onChangeTab,
  orders = NO_ORDERS,
  loading = false,
  loadError = false,
  hasNext = false,
  loadingMore = false,
  onRetry,
  onRefresh,
  onLoadMore,
  onCancel,
  onOpenAsset,
  onBack,
  now,
}: MarketOrdersScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const column = useResponsiveColumn();
  const inset = useHeaderContentInset();
  const screenStyle = useScreenStyle([]);
  const [confirming, setConfirming] = useState<MarketOrder | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const confirmCancel = async () => {
    const order = confirming;
    setConfirming(null);
    if (!order || cancelling != null) return;
    setCancelling(order.orderId);
    try {
      await Promise.resolve(onCancel?.(order.orderId));
    } finally {
      setCancelling(null);
    }
  };

  const tabLabel = (key: MarketOrdersFilter) =>
    tr(key === 'OPEN' ? 'market.orders.tabOpen' : 'market.orders.tabClosed');

  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader title={tr('market.orders.title')} onBack={onBack} />
      <PawRefreshScroll
        onRefresh={onRefresh}
        contentContainerStyle={[styles.body, column, { paddingTop: inset || Spacing.four }]}>
        <View style={styles.segment}>
          {TABS.map((key) => {
            const active = key === tab;
            const label = tabLabel(key);
            return (
              <Pressable
                key={key}
                onPress={() => onChangeTab?.(key)}
                accessibilityRole="button"
                accessibilityLabel={tr('market.orders.tabA11y', { label })}
                accessibilityState={{ selected: active }}
                style={[styles.segBtn, { backgroundColor: active ? t.primary : t.surfaceMuted }]}>
                <Text
                  style={[Typography.supporting, { color: active ? t.onPrimary : t.textMuted }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.state}>
            <Loading />
          </View>
        ) : loadError ? (
          <View style={styles.state}>
            <RetryState message={tr('market.orders.error')} onRetry={onRetry} />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.state}>
            <Text style={[Typography.body, { color: t.textMuted }]}>
              {tr('market.orders.empty')}
            </Text>
          </View>
        ) : (
          orders.map((o) => {
            const expiry = o.status === 'OPEN' ? expiryLabel(o.expiresAt, now ?? new Date()) : null;
            return (
              <View key={o.orderId} style={[styles.row, { backgroundColor: t.surface }]}>
                <Pressable
                  onPress={() => onOpenAsset?.(o.assetId)}
                  disabled={!onOpenAsset}
                  accessibilityRole="button"
                  accessibilityLabel={tr('market.orders.rowA11y', { name: o.name })}
                  style={styles.rowMain}>
                  <MarketAssetImage assetKey={o.assetKey} name={o.name} size={ROW_IMAGE} />
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={[Typography.label, { color: t.text }]}>
                      {o.name}
                    </Text>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      {tr(`market.orders.side.${o.side}`)}
                      {o.source === 'ISSUANCE' ? ` · ${tr('market.orders.issuance')}` : ''}
                      {' · '}
                      {tr(`market.orders.status.${o.status}`)}
                    </Text>
                    <Text style={[Typography.supporting, { color: t.text }]}>
                      {tr('market.orders.priceLine', {
                        price: o.price,
                        filled: o.filledQuantity,
                        quantity: o.quantity,
                      })}
                    </Text>
                    {expiry ? (
                      <Text style={[Typography.supporting, { color: t.textMuted }]}>
                        {tr(`market.orders.expires.${expiry.key}`, { n: expiry.n })}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                {o.status === 'OPEN' && onCancel ? (
                  <Pressable
                    onPress={() => setConfirming(o)}
                    disabled={cancelling != null}
                    accessibilityRole="button"
                    accessibilityLabel={tr('market.orders.cancelA11y', { name: o.name })}
                    accessibilityState={{ disabled: cancelling != null }}
                    style={[styles.cancelBtn, { backgroundColor: t.surfaceMuted }]}>
                    <Text
                      style={[
                        Typography.supporting,
                        { color: cancelling === o.orderId ? t.textDisabled : t.danger },
                      ]}>
                      {tr('market.orders.cancel')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}

        {!loading && !loadError && hasNext ? (
          <Button
            label={tr('market.orders.more')}
            variant="secondary"
            onPress={onLoadMore}
            disabled={loadingMore}
          />
        ) : null}
      </PawRefreshScroll>

      <ConfirmDialog
        visible={confirming != null}
        title={tr('market.orders.cancelTitle')}
        body={tr('market.orders.cancelBody')}
        confirmLabel={tr('market.orders.cancelConfirm')}
        cancelLabel={tr('market.orders.cancelKeep')}
        destructive
        onConfirm={() => void confirmCancel()}
        onCancel={() => setConfirming(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, gap: Spacing.half },
  body: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  segment: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  segBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  state: { alignItems: 'center', paddingVertical: Spacing.five },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.lg,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cancelBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
