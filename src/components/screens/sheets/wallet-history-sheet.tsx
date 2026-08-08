import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { WalletHistoryEntry } from '@/api/adapters';
import { BottomSheet } from '@/components/ui/bottom-sheet';
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

      {loadError ? (
        <View style={styles.stateBlock}>
          <RetryState message="재화 내역을 불러오지 못했어요." onRetry={onRetry} />
        </View>
      ) : loading && entries.length === 0 ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : entries.length === 0 ? (
        <Text style={[Typography.body, styles.empty, { color: t.textMuted }]}>
          아직 재화 내역이 없어요
        </Text>
      ) : (
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
                  <ActivityIndicator color={t.primary} size="small" />
                ) : (
                  <Text style={[Typography.label, { color: t.text }]}>더보기</Text>
                )}
              </Pressable>
            ) : null
          }
        />
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 2,
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
