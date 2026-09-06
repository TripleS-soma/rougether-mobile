import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { WalletHistoryEntry } from '@/api/adapters';
import { Loading } from '@/components/ui/loading';
import { BottomSheet, SheetDragExclude } from '@/components/ui/bottom-sheet';
import { CurrencyGuide } from '@/components/ui/currency-guide';
import { Icon } from '@/components/ui/icon';
import { RetryState } from '@/components/ui/retry-state';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { relativeTimeLabel } from '@/utils/datetime';

export type WalletHistorySheetProps = {
  visible: boolean;
  onClose: () => void;
  /** 최신순 이력 (#734). */
  entries: WalletHistoryEntry[];
  loading?: boolean;
  /** 첫 페이지 로드 실패 — 재시도 노출. */
  loadError?: boolean;
  onRetry?: () => void;
  /** 다음 페이지 존재 (더보기). */
  hasNext?: boolean;
  onLoadMore?: () => void;
};

/**
 * 재화 내역 바텀시트 (#734) — 지갑 필 탭으로 열린다. 적립은 +초록, 사용은
 * −빨강으로 부호를 그대로 보여주고, 각 행에 증감 직후 잔액을 함께 적는다.
 * 맨 위의 접이식 안내(#789)가 "어디서 모으고 어디에 쓰는지"를 답한다 — 내역은
 * 지나간 일만 말하고, 앞으로 뭘 하면 되는지는 어디에도 없었다.
 */
export function WalletHistorySheet({
  visible,
  onClose,
  entries,
  loading = false,
  loadError = false,
  onRetry,
  hasNext = false,
  onLoadMore,
}: WalletHistorySheetProps) {
  const t = useTokens();
  const Typography = useTypography();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={styles.head}>
        <Text style={[Typography.h3, { color: t.text }]}>재화 내역</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="재화 내역 닫기"
          style={[styles.closeBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="close" size={16} color={t.text} />
        </Pressable>
      </View>

      {/* 안내는 상태와 무관하게 늘 맨 위 — 내역이 비었을 때(신규 계정)가 오히려
          가장 필요한 순간이다 (#789). 기본 접힘이라 내역을 가리지 않는다. */}
      <View style={styles.guide}>
        <CurrencyGuide />
      </View>

      {loadError ? (
        <View style={styles.stateBlock}>
          <RetryState message="재화 내역을 불러오지 못했어요." onRetry={onRetry} />
        </View>
      ) : loading && entries.length === 0 ? (
        <View style={styles.stateBlock}>
          <Loading />
        </View>
      ) : entries.length === 0 ? (
        <Text style={[Typography.body, styles.empty, { color: t.textMuted }]}>
          아직 재화 내역이 없어요
        </Text>
      ) : (
        <SheetDragExclude>
          {/* 세로 스크롤 본문 — 시트 끌어내리기에서 제외 (#1132). 닫기는 손잡이·헤더에서. */}
          <FlatList
            data={entries}
            keyExtractor={(e) => String(e.id)}
            style={styles.list}
            contentContainerStyle={styles.listBody}
            renderItem={({ item }) => {
              const earn = item.amount > 0;
              return (
                <View style={[styles.row, { backgroundColor: t.surface }]}>
                  <Icon
                    name={item.currency === 'diamond' ? 'diamond' : 'coin'}
                    size={16}
                    color={item.currency === 'diamond' ? t.primary : t.warning}
                  />
                  <View style={styles.rowBody}>
                    <Text style={[Typography.body, { color: t.text }]} numberOfLines={1}>
                      {item.reason}
                    </Text>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      {item.createdAt ? relativeTimeLabel(new Date(item.createdAt)) : ''}
                      {' · 잔액 '}
                      {item.balanceAfter.toLocaleString()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      Typography.label,
                      styles.amount,
                      { color: earn ? t.primaryText : t.danger },
                    ]}>
                    {earn ? '+' : ''}
                    {item.amount.toLocaleString()}
                  </Text>
                </View>
              );
            }}
            ListFooterComponent={
              hasNext ? (
                <Pressable
                  onPress={onLoadMore}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="재화 내역 더보기"
                  style={[styles.moreBtn, { backgroundColor: t.surfaceMuted }]}>
                  {loading ? (
                    <Loading size="small" />
                  ) : (
                    <Text style={[Typography.label, { color: t.text }]}>더보기</Text>
                  )}
                </Pressable>
              ) : null
            }
          />
        </SheetDragExclude>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.four,
    maxHeight: '75%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guide: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  stateBlock: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.six,
  },
  list: {
    flexGrow: 0,
  },
  listBody: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowBody: {
    flex: 1,
    gap: Spacing.half,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
  moreBtn: {
    marginTop: Spacing.two,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
