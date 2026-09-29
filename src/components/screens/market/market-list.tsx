import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MarketAssetCard } from '@/api/market';
import { MarketAssetImage } from '@/components/screens/market/market-asset-image';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Loading } from '@/components/ui/loading';
import { RetryState } from '@/components/ui/retry-state';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 카드 그림 한 변 — 꾸미기 격자 타일과 같은 결의 정사각. */
const CARD_IMAGE = 120;

export type MarketListProps = {
  assets?: MarketAssetCard[];
  loading?: boolean;
  loadError?: boolean;
  hasNext?: boolean;
  loadingMore?: boolean;
  onRetry?: () => void;
  /** 새로고침 — 꾸미기 패널은 바깥 스크롤 안이라 당겨서 새로고침 대신 버튼으로. */
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onOpenAsset?: (assetId: number) => void;
  onOpenOrders?: () => void;
};

const NO_ASSETS: MarketAssetCard[] = [];

/**
 * 거래소 목록 (#1427) — 꾸미기(상점) 패널의 "거래소" 탭 안에 들어가는 카드 격자. 스스로
 * 스크롤하지 않는다(꾸미기 화면의 스크롤 안에 산다) — 다음 페이지는 "더 보기" 버튼.
 * 카드: 그림·이름·제작자(탈퇴 시 "탈퇴한 회원")·최저 판매가("N코인부터"/"판매 대기 없음")·
 * 최근 거래가.
 */
export function MarketList({
  assets = NO_ASSETS,
  loading = false,
  loadError = false,
  hasNext = false,
  loadingMore = false,
  onRetry,
  onRefresh,
  onLoadMore,
  onOpenAsset,
  onOpenOrders,
}: MarketListProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();

  return (
    <View style={styles.wrap} testID="market-list">
      <View style={styles.head}>
        <Pressable
          onPress={onOpenOrders}
          accessibilityRole="button"
          accessibilityLabel={tr('market.list.myOrders')}
          style={[styles.chip, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="list" size={14} color={t.text} />
          <Text style={[Typography.supporting, { color: t.text }]}>
            {tr('market.list.myOrders')}
          </Text>
        </Pressable>
        {onRefresh ? (
          <Pressable
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel={tr('market.list.refreshA11y')}
            hitSlop={8}
            style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="refresh" size={14} color={t.text} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.state}>
          <Loading />
        </View>
      ) : loadError ? (
        <View style={styles.state}>
          <RetryState message={tr('market.list.error')} onRetry={onRetry} />
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.state}>
          <Text style={[Typography.label, { color: t.text }]}>{tr('market.list.empty')}</Text>
          <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
            {tr('market.list.emptyHint')}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {assets.map((a) => (
            <Pressable
              key={a.assetId}
              onPress={() => onOpenAsset?.(a.assetId)}
              accessibilityRole="button"
              accessibilityLabel={tr('market.list.cardA11y', { name: a.name })}
              style={[styles.card, { backgroundColor: t.surfaceMuted }]}>
              <MarketAssetImage assetKey={a.assetKey} name={a.name} size={CARD_IMAGE} />
              <Text numberOfLines={1} style={[Typography.label, { color: t.text }]}>
                {a.name}
              </Text>
              <Text numberOfLines={1} style={[Typography.supporting, { color: t.textMuted }]}>
                {a.creatorNickname != null
                  ? tr('market.creator', { name: a.creatorNickname })
                  : tr('market.creatorUnknown')}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  Typography.supporting,
                  { color: a.bestAskPrice != null ? t.primaryText : t.textMuted },
                ]}>
                {a.bestAskPrice != null
                  ? tr('market.list.fromPrice', { price: a.bestAskPrice })
                  : tr('market.list.noAsk')}
              </Text>
              <Text numberOfLines={1} style={[Typography.supporting, { color: t.textMuted }]}>
                {a.lastTradePrice != null
                  ? tr('market.list.lastPrice', { price: a.lastTradePrice })
                  : tr('market.list.noTrade')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!loading && !loadError && hasNext ? (
        <Button
          label={tr('market.list.more')}
          variant="secondary"
          onPress={onLoadMore}
          disabled={loadingMore}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  iconBtn: {
    padding: Spacing.two,
    borderRadius: Radius.pill,
  },
  state: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  center: { textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    // 두 열 — 홀수 개여도 마지막 카드가 한 줄을 다 먹지 않게 늘리지 않는다.
    width: '48%',
    padding: Spacing.two,
    borderRadius: Radius.lg,
    gap: Spacing.half,
    alignItems: 'center',
  },
});
