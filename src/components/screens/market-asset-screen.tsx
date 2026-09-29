import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MarketAsset, MarketPriceLevel, MarketTrade } from '@/api/market';
import type { MarketSide, MarketSource } from '@/api/types';
import { MarketAssetImage } from '@/components/screens/market/market-asset-image';
import {
  MarketOrderSheet,
  type MarketOrderDraft,
} from '@/components/screens/market/market-order-sheet';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { RetryState } from '@/components/ui/retry-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { MARKET_BOOK_DEPTH } from '@/constants/market';
import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { relativeTimeLabel } from '@/utils/datetime';

/** 체결 시각 → "N분 전"/"M월 D일". 시각이 없거나 깨졌으면 빈칸. */
function tradedLabel(at: string, now: Date | undefined): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : relativeTimeLabel(d, now);
}

/** 상세 그림 한 변. */
const HERO_IMAGE = 200;

export type MarketPlaceOrder = (order: {
  side: MarketSide;
  source?: MarketSource;
  price: number;
  quantity: number;
}) => Promise<boolean> | boolean | void;

export type MarketAssetScreenProps = {
  asset?: MarketAsset | null;
  trades?: MarketTrade[];
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  onRefresh?: () => Promise<unknown> | void;
  coinBalance?: number;
  /**
   * 주문 — 접수(202)까지 갔으면 true를 돌려 시트를 닫는다. false(즉시 거절)면 시트를 열어 둔 채
   * 고칠 수 있다. 결과 안내(토스트)는 호출부 몫.
   */
  onPlaceOrder?: MarketPlaceOrder;
  onOpenOrders?: () => void;
  /**
   * 신고 (App Store 1.2 — 공개 UGC). 넘겼을 때만 "신고하기"를 보여준다 — 신고 API
   * (서버 #423) 배선은 별도 작업.
   */
  onReport?: (assetId: number) => void;
  onBack?: () => void;
  /** 상대 시각 기준 — 테스트 고정용. */
  now?: Date;
};

const NO_TRADES: MarketTrade[] = [];

/**
 * 거래소 가구 상세 (#1427) — KREAM처럼 상품 카드 + 구매·판매 버튼. 호가·매칭은 서버 몫이라
 * 호가는 위 3단계 요약만 보여준다.
 * - 구매하기: 보유 중이면 막고 이유를 적는다(같은 가구 1개 규칙).
 * - 판매하기: 보유 중일 때(INVENTORY, 1개).
 * - 발행 재고 판매: 제작자이고 남은 발행 재고가 있을 때(ISSUANCE, 1~min(10, 남은 재고)).
 * - 거래 정지(SUSPENDED): 배너 + 버튼 전부 비활성.
 */
export function MarketAssetScreen({
  asset = null,
  trades = NO_TRADES,
  loading = false,
  loadError = false,
  onRetry,
  onRefresh,
  coinBalance = 0,
  onPlaceOrder,
  onOpenOrders,
  onReport,
  onBack,
  now,
}: MarketAssetScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const column = useResponsiveColumn();
  const inset = useHeaderContentInset();
  const screenStyle = useScreenStyle([]);
  const [draft, setDraft] = useState<MarketOrderDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async ({ price, quantity }: { price: number; quantity: number }) => {
    if (!draft || submitting) return;
    setSubmitting(true);
    try {
      const accepted = await Promise.resolve(onPlaceOrder?.({ ...draft, price, quantity }));
      if (accepted !== false) setDraft(null);
    } finally {
      setSubmitting(false);
    }
  };

  const suspended = asset?.status === 'SUSPENDED';
  const canIssue = !!asset && asset.isCreator && asset.unissuedQuantity > 0;

  const levels = (list: MarketPriceLevel[], label: string) => (
    <View style={styles.flex}>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>{label}</Text>
      {list.length === 0 ? (
        <Text style={[Typography.supporting, { color: t.textDisabled }]}>
          {tr('market.asset.bookEmpty')}
        </Text>
      ) : (
        list.slice(0, MARKET_BOOK_DEPTH).map((l) => (
          <View key={l.price} style={styles.levelRow}>
            <Text style={[Typography.label, styles.flex, { color: t.text }]}>
              {tr('market.coins', { n: l.price })}
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('market.asset.levelQty', { n: l.quantity })}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader title={tr('market.asset.title')} onBack={onBack} />
      <PawRefreshScroll
        onRefresh={onRefresh}
        contentContainerStyle={[styles.body, column, { paddingTop: inset || Spacing.four }]}>
        {loading && !asset ? (
          <View style={styles.state}>
            <Loading />
          </View>
        ) : !asset ? (
          loadError ? (
            <View style={styles.state}>
              <RetryState message={tr('market.asset.loadError')} onRetry={onRetry} />
            </View>
          ) : null
        ) : (
          <>
            {suspended ? (
              <View
                accessibilityRole="alert"
                style={[styles.banner, { backgroundColor: t.warningSoft }]}>
                <Text style={[Typography.label, { color: t.warningText }]}>
                  {tr('market.asset.suspended')}
                </Text>
              </View>
            ) : null}

            <View style={[styles.card, styles.hero, { backgroundColor: t.surface }]}>
              <MarketAssetImage assetKey={asset.assetKey} name={asset.name} size={HERO_IMAGE} />
              <Text style={[Typography.h2, styles.center, { color: t.text }]}>{asset.name}</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {asset.creatorNickname != null
                  ? tr('market.creator', { name: asset.creatorNickname })
                  : tr('market.creatorUnknown')}
                {' · '}
                {tr('market.asset.edition', { n: asset.totalSupply })}
              </Text>
            </View>

            <View style={[styles.card, styles.stats, { backgroundColor: t.surface }]}>
              <View style={styles.flex}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {tr('market.asset.bestAsk')}
                </Text>
                <Text style={[Typography.h3, { color: t.primaryText }]}>
                  {asset.bestAskPrice != null
                    ? tr('market.coins', { n: asset.bestAskPrice })
                    : tr('market.asset.none')}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {tr('market.asset.lastTrade')}
                </Text>
                <Text style={[Typography.h3, { color: t.text }]}>
                  {asset.lastTradePrice != null
                    ? tr('market.coins', { n: asset.lastTradePrice })
                    : tr('market.asset.none')}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                label={tr('market.asset.buy')}
                onPress={() => setDraft({ side: 'BUY' })}
                disabled={suspended || asset.owned}
              />
              {asset.owned ? (
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {tr('market.asset.ownedReason')}
                </Text>
              ) : null}
              {asset.owned ? (
                <Button
                  label={tr('market.asset.sell')}
                  variant="secondary"
                  onPress={() => setDraft({ side: 'SELL', source: 'INVENTORY' })}
                  disabled={suspended}
                />
              ) : null}
              {canIssue ? (
                <>
                  <Button
                    label={tr('market.asset.sellIssuance')}
                    variant="secondary"
                    onPress={() => setDraft({ side: 'SELL', source: 'ISSUANCE' })}
                    disabled={suspended}
                  />
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {tr('market.asset.unissued', { n: asset.unissuedQuantity })}
                  </Text>
                </>
              ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: t.surface }]}>
              <Text style={[Typography.label, { color: t.text }]}>{tr('market.asset.book')}</Text>
              <View style={styles.book}>
                {levels(asset.asks, tr('market.asset.asks'))}
                {levels(asset.bids, tr('market.asset.bids'))}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: t.surface }]}>
              <Text style={[Typography.label, { color: t.text }]}>{tr('market.asset.trades')}</Text>
              {trades.length === 0 ? (
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {tr('market.asset.tradesEmpty')}
                </Text>
              ) : (
                trades.map((trade) => (
                  <View key={trade.tradeId} style={styles.levelRow}>
                    <Text style={[Typography.body, styles.flex, { color: t.text }]}>
                      {tr('market.coins', { n: trade.price })}
                    </Text>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      {tradedLabel(trade.tradedAt, now)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.footer}>
              {onOpenOrders ? (
                <Button
                  label={tr('market.asset.myOrders')}
                  variant="secondary"
                  leftIcon="list"
                  onPress={onOpenOrders}
                />
              ) : null}
              {onReport ? (
                <Button
                  label={tr('market.asset.report')}
                  variant="secondary"
                  onPress={() => onReport(asset.assetId)}
                />
              ) : null}
            </View>
          </>
        )}
      </PawRefreshScroll>

      {asset ? (
        <MarketOrderSheet
          visible={draft != null}
          draft={draft}
          asset={asset}
          coinBalance={coinBalance}
          submitting={submitting}
          onSubmit={(o) => void submit(o)}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  state: { alignItems: 'center', paddingVertical: Spacing.five },
  banner: { padding: Spacing.three, borderRadius: Radius.lg },
  card: { padding: Spacing.three, borderRadius: Radius.lg, gap: Spacing.two },
  hero: { alignItems: 'center' },
  center: { textAlign: 'center' },
  stats: { flexDirection: 'row', gap: Spacing.three },
  actions: { gap: Spacing.two },
  book: { flexDirection: 'row', gap: Spacing.four },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  footer: { gap: Spacing.two },
});
