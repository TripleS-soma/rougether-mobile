import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { FeedAuthorHouse } from '@/api/feed-houses';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { RetryState } from '@/components/ui/retry-state';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type FeedAuthorHouseSheetProps = {
  visible: boolean;
  houses: readonly FeedAuthorHouse[];
  loading?: boolean;
  error?: boolean;
  joiningId?: number | null;
  onRetry?: () => void;
  onClose?: () => void;
  onJoin?: (houseId: number) => void;
  onOpenHouse?: (houseId: number) => void;
};

export function FeedAuthorHouseSheet({
  visible,
  houses,
  loading,
  error,
  joiningId,
  onRetry,
  onClose,
  onJoin,
  onOpenHouse,
}: FeedAuthorHouseSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const busy = joiningId != null;
  return (
    <BottomSheet
      visible={visible}
      accessibilityLabel={tr('feed.house.title')}
      onClose={busy ? undefined : onClose}
      dragEnabled={!busy}
      dragScope="header"
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <SheetHandle />
      <Text style={[Typography.h2, { color: t.text }]}>{tr('feed.house.title')}</Text>
      <Text style={[Typography.body, { color: t.textMuted }]}>{tr('feed.house.hint')}</Text>
      {loading ? (
        <Loading />
      ) : error ? (
        <RetryState message={tr('feed.house.loadError')} onRetry={onRetry} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {houses.length === 0 ? (
            <Text style={[Typography.body, { color: t.textMuted }]}>{tr('feed.house.empty')}</Text>
          ) : (
            houses.map((house) => {
              const label =
                joiningId === house.houseId
                  ? tr('feed.house.working')
                  : house.isMember
                    ? tr('feed.house.open')
                    : house.myMembershipStatus === 'KICKED'
                      ? tr('feed.house.kicked')
                      : !house.requiresApproval && house.canJoin
                        ? tr('feed.house.request')
                        : house.myJoinRequestStatus === 'PENDING'
                          ? tr('feed.house.pending')
                          : house.isFull
                            ? tr('feed.house.full')
                            : tr('feed.house.request');
              return (
                <View key={house.houseId} style={[styles.card, { backgroundColor: t.surface }]}>
                  <Text style={[Typography.label, { color: t.text }]}>{house.name}</Text>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {house.maxMembers == null
                      ? tr('feed.house.membersUnlimited', { count: house.currentMemberCount })
                      : tr('feed.house.members', {
                          count: house.currentMemberCount,
                          max: house.maxMembers,
                        })}
                  </Text>
                  {!house.isMember ? (
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      {house.requiresApproval
                        ? tr('feed.house.approvalHint')
                        : tr('feed.house.instantHint')}
                    </Text>
                  ) : null}
                  <Button
                    label={label}
                    accessibilityLabel={`${house.name}, ${label}`}
                    disabled={busy || (!house.isMember && !house.canJoin)}
                    onPress={() =>
                      house.isMember ? onOpenHouse?.(house.houseId) : onJoin?.(house.houseId)
                    }
                  />
                </View>
              );
            })
          )}
        </ScrollView>
      )}
      <Button
        label={tr('feed.house.close')}
        variant="secondary"
        disabled={busy}
        onPress={onClose}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '85%',
  },
  list: { gap: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Radius.lg, gap: Spacing.two },
});
