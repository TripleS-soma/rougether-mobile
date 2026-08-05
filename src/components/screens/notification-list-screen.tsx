import { type ReactNode, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon, type IconName } from '@/components/ui/icon';
import { RetryState } from '@/components/ui/retry-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { DEMO_NOTIFICATIONS } from '@/mocks/fixtures';

/** One notification row (server GET /notifications). */
export type NotificationEntry = {
  id: number;
  /** Server type code — picks the row icon (unknown types fall back to the bell). */
  type?: string;
  title: string;
  body: string;
  read: boolean;
  /** Display date, e.g. "7월 8일". */
  date: string;
};

/** Row icon by server notification type. */
const TYPE_ICONS: Record<string, IconName> = {
  ROUTINE_REMINDER: 'bell',
  TODO_REMINDER: 'bell',
  HOUSE_KICK: 'house',
  // 친구 응원 알림 (#330 응원 보내기의 수신측) — 스웨거 enum 추가분.
  FRIEND_CHEER: 'heart',
  HOUSE_MISSION_ACHIEVED: 'flame',
  HOUSE_MEMBER_JOINED: 'members',
  HOUSE_MEMBER_LEFT: 'leave',
  // 입주 신청 결과 (#595, 서버 #241) — 수락은 집, 거절도 같은 맥락의 집 알림.
  HOUSE_JOIN_REQUEST_ACCEPTED: 'house',
  HOUSE_JOIN_REQUEST_REJECTED: 'house',
};

export type NotificationListScreenProps = {
  /** Server notifications (newest first); omit for the demo preview list. */
  notifications?: NotificationEntry[];
  loading?: boolean;
  /** True when the first-page load failed (#549) — 빈 상태와 구분해 표시. */
  loadError?: boolean;
  /** Re-run the failed load (다시 시도 button). */
  onRetry?: () => void;
  /** More pages exist server-side (shows 더보기). */
  hasNext?: boolean;
  onBack?: () => void;
  /** Mark one notification read (fired on tapping an unread row). */
  onRead?: (id: number) => void;
  /** Mark everything read (header button; shown while something is unread). */
  onReadAll?: () => void;
  onLoadMore?: () => void;
};

/**
 * 읽지 않은 행의 스와이프 읽음 처리 (#560) — 왼쪽으로 밀면 '읽음' 액션이
 * 드러나고, 임계를 넘겨 놓거나 액션을 탭하면 onRead 후 닫힌다. 읽은 행은
 * 스와이프 비활성. FlatList 세로 스크롤과의 중재는 ReanimatedSwipeable의
 * 가로 activeOffset이 처리한다.
 */
function SwipeReadRow({
  entry,
  onRead,
  children,
}: {
  entry: NotificationEntry;
  onRead?: (id: number) => void;
  children: ReactNode;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const swipeRef = useRef<SwipeableMethods>(null);
  const markRead = () => {
    swipeRef.current?.close();
    onRead?.(entry.id);
  };
  // 읽은 행(또는 콜백 미배선)은 스와이프 없이 그대로 — reveal할 액션이 없다.
  if (entry.read || !onRead) return children;
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      testID={`notification-swipe-${entry.id}`}
      overshootRight={false}
      rightThreshold={48}
      onSwipeableWillOpen={markRead}
      renderRightActions={() => (
        <Pressable
          onPress={markRead}
          accessibilityRole="button"
          accessibilityLabel={`${entry.title} 읽음`}
          style={[styles.readAction, { backgroundColor: t.primary }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>읽음</Text>
        </Pressable>
      )}>
      {children}
    </ReanimatedSwipeable>
  );
}

/**
 * "알림" list screen (server GET /notifications): newest-first rows with an
 * unread accent dot; tapping an unread row marks it read, the header's 모두
 * 읽음 clears everything. Pure + prop-driven.
 */
export function NotificationListScreen({
  notifications,
  loading = false,
  loadError = false,
  onRetry,
  hasNext = false,
  onBack,
  onRead,
  onReadAll,
  onLoadMore,
}: NotificationListScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const entries = notifications ?? DEMO_NOTIFICATIONS;
  const hasUnread = entries.some((n) => !n.read);

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader
        title="알림"
        onBack={onBack}
        right={
          hasUnread ? (
            <Pressable
              onPress={onReadAll}
              accessibilityRole="button"
              accessibilityLabel="모두 읽음"
              style={[styles.readAllBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: t.primaryText }]}>모두 읽음</Text>
            </Pressable>
          ) : undefined
        }
      />

      <FlatList
        data={entries}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={styles.body}
        ListEmptyComponent={
          loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : loadError ? (
            // 로드 실패 (#549) — 빈 상태('알림 없음')로 위장하지 않는다.
            <View style={styles.state}>
              <RetryState message="알림을 불러오지 못했어요." onRetry={onRetry} />
            </View>
          ) : (
            <Text style={[Typography.supporting, styles.state, { color: t.textMuted }]}>
              아직 받은 알림이 없어요.
            </Text>
          )
        }
        ListFooterComponent={
          hasNext && entries.length > 0 ? (
            <Pressable
              onPress={onLoadMore}
              accessibilityRole="button"
              accessibilityLabel="알림 더보기"
              style={[styles.more, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: t.primaryText }]}>더보기</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item: n }) => (
          <SwipeReadRow entry={n} onRead={onRead}>
            <Pressable
              onPress={() => !n.read && onRead?.(n.id)}
              accessibilityRole="button"
              accessibilityLabel={n.title}
              accessibilityState={{ selected: !n.read }}
              style={[
                styles.row,
                { backgroundColor: n.read ? t.surfaceMuted : t.surface, borderColor: t.border },
              ]}>
              <View style={[styles.rowIcon, { backgroundColor: t.surfaceMuted }]}>
                <Icon name={TYPE_ICONS[n.type ?? ''] ?? 'bell'} size={18} color={t.text} />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowHead}>
                  <Text style={[Typography.label, { color: t.text }]}>{n.title}</Text>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>{n.date}</Text>
                </View>
                <Text style={[Typography.body, { color: n.read ? t.textMuted : t.text }]}>
                  {n.body}
                </Text>
              </View>
              {!n.read ? <View style={[styles.unreadDot, { backgroundColor: t.primary }]} /> : null}
            </Pressable>
          </SwipeReadRow>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  state: {
    alignItems: 'center',
    textAlign: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.three,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  readAction: {
    width: 72,
    marginLeft: Spacing.two,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readAllBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  more: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
