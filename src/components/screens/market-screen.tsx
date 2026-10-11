import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MarketAssetCard } from '@/api/market';
import { MarketList } from '@/components/screens/market/market-list';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { ScreenHeader } from '@/components/ui/screen-header';
import { WalletPills } from '@/components/ui/wallet-pills';
import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type MarketScreenProps = {
  assets?: MarketAssetCard[];
  loading?: boolean;
  loadError?: boolean;
  hasNext?: boolean;
  loadingMore?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void | Promise<unknown>;
  onLoadMore?: () => void;
  onOpenAsset?: (assetId: number) => void;
  onOpenOrders?: () => void;
  coinBalance?: number;
  diamondBalance?: number;
  /** 판매 중인 내 가구 수 — 서버가 가구함에서 숨기므로 여기서 알린다. 0이면 줄이 없다. */
  sellingCount?: number;
  onBack?: () => void;
};

/**
 * 가구 거래소 (#1427 → #1502 독립 화면) — 방 화면 전체 메뉴(≡)에서 연다. 예전엔 꾸미기 탭
 * 줄 끝에 있어 좁은 화면에서 밀려나 들어가기 어려웠다(#1495).
 *
 * 순수 화면: 목록·잔액·판매 중 수는 prop. 판매 중 줄 → 내 주문, 카드 → 상세.
 */
export function MarketScreen({
  assets,
  loading = false,
  loadError = false,
  hasNext = false,
  loadingMore = false,
  onRetry,
  onRefresh,
  onLoadMore,
  onOpenAsset,
  onOpenOrders,
  coinBalance = 0,
  diamondBalance = 0,
  sellingCount = 0,
  onBack,
}: MarketScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const column = useResponsiveColumn();
  const inset = useHeaderContentInset();
  const screenStyle = useScreenStyle([]);

  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader
        title={tr('market.screen.title')}
        onBack={onBack}
        right={<WalletPills coin={coinBalance} diamond={diamondBalance} compact />}
      />
      <PawRefreshScroll
        onRefresh={onRefresh}
        contentContainerStyle={[styles.body, column, { paddingTop: inset || Spacing.four }]}>
        {/* 판매 중인 내 가구 (#1427) — 서버가 가구함에서 숨겨 꾸미기 격자에 자리가 없다. */}
        {sellingCount > 0 ? (
          <View style={[styles.sellingRow, { backgroundColor: t.surfaceMuted }]}>
            <View style={styles.flex}>
              <Text style={[Typography.label, { color: t.text }]}>
                {tr('market.selling.row', { n: sellingCount })}
              </Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {tr('market.selling.rowHint')}
              </Text>
            </View>
            {onOpenOrders ? (
              <Pressable
                onPress={onOpenOrders}
                accessibilityRole="button"
                accessibilityLabel={tr('market.selling.open')}
                style={[styles.sellingBtn, { backgroundColor: t.surface }]}>
                <Text style={[Typography.supporting, { color: t.primaryText }]}>
                  {tr('market.selling.open')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <MarketList
          assets={assets}
          loading={loading}
          loadError={loadError}
          hasNext={hasNext}
          loadingMore={loadingMore}
          onRetry={onRetry}
          onRefresh={onRefresh ? () => void onRefresh() : undefined}
          onLoadMore={onLoadMore}
          onOpenAsset={onOpenAsset}
          onOpenOrders={onOpenOrders}
        />
      </PawRefreshScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  body: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sellingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  sellingBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
