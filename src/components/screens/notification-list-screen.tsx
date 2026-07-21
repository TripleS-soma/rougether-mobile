import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

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

const DEFAULT_NOTIFICATIONS: NotificationEntry[] = [
  { id: 1, type: 'ROUTINE_REMINDER', title: '루틴 리마인드', body: '물 마시기 할 시간이에요', read: false, date: '오늘' }, // prettier-ignore
  { id: 2, type: 'HOUSE_KICK', title: '집 알림', body: '아침 기상단에서 내보내졌어요', read: true, date: '7월 5일' }, // prettier-ignore
];

/** Row icon by server notification type. */
const TYPE_ICONS: Record<string, IconName> = {
  ROUTINE_REMINDER: 'bell',
  HOUSE_KICK: 'house',
  // 친구 응원 알림 (#330 응원 보내기의 수신측) — 스웨거 enum 추가분.
  FRIEND_CHEER: 'heart',
};

export type NotificationListScreenProps = {
  /** Server notifications (newest first); omit for the demo preview list. */
  notifications?: NotificationEntry[];
  loading?: boolean;
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
 * "알림" list screen (server GET /notifications): newest-first rows with an
 * unread accent dot; tapping an unread row marks it read, the header's 모두
 * 읽음 clears everything. Pure + prop-driven.
 */
export function NotificationListScreen({
  notifications,
  loading = false,
  hasNext = false,
  onBack,
  onRead,
  onReadAll,
  onLoadMore,
}: NotificationListScreenProps) {
  const t = useTokens();
  const entries = notifications ?? DEFAULT_NOTIFICATIONS;
  const hasUnread = entries.some((n) => !n.read);

  return (
    <View style={[styles.screen, useScreenStyle()]}>
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

      <ScrollView contentContainerStyle={styles.body}>
        {loading && entries.length === 0 ? (
          <View style={styles.state}>
            <ActivityIndicator color={t.primary} />
          </View>
        ) : entries.length === 0 ? (
          <Text style={[Typography.supporting, styles.state, { color: t.textMuted }]}>
            아직 받은 알림이 없어요.
          </Text>
        ) : (
          <View style={styles.list}>
            {entries.map((n) => (
              <Pressable
                key={n.id}
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
                {!n.read ? (
                  <View style={[styles.unreadDot, { backgroundColor: t.primary }]} />
                ) : null}
              </Pressable>
            ))}
            {hasNext ? (
              <Pressable
                onPress={onLoadMore}
                accessibilityRole="button"
                accessibilityLabel="알림 더보기"
                style={[styles.more, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.primaryText }]}>더보기</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.four,
  },
  state: {
    alignItems: 'center',
    textAlign: 'center',
    paddingVertical: Spacing.six,
  },
  list: {
    gap: Spacing.two,
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
