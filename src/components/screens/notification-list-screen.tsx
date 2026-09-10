import { type ReactNode, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loading } from '@/components/ui/loading';
import { Icon } from '@/components/ui/icon';
import { notificationIcon } from '@/constants/notifications';
import { RetryState } from '@/components/ui/retry-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
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
  /** 하나 삭제 (#1137) — 스와이프. 넘기지 않으면 스와이프가 꺼진다. */
  onDelete?: (id: number) => void;
  /** 전체 삭제 (#1137) — 헤더 버튼 → 확인 다이얼로그를 거친 뒤에만 호출된다. */
  onDeleteAll?: () => void;
  onLoadMore?: () => void;
};

/** 짧게 밀었을 때 드러나는 삭제 버튼 폭. */
const DELETE_ACTION_W = 72;

/** 행 폭의 이 비율 이상 밀린 채로 놓으면 "끝까지 밀기"로 본다 (#1137). */
export const FULL_SWIPE_RATIO = 0.5;

/**
 * 끝까지 밀었나 (#1137) — 놓는 순간 행이 폭의 절반 넘게 왼쪽으로 밀려 있으면 즉시
 * 삭제. 폭을 아직 못 쟀으면(0) 즉시 삭제하지 않고 버튼만 드러낸다.
 */
export function isFullSwipe(translationX: number, rowWidth: number): boolean {
  return rowWidth > 0 && -translationX >= rowWidth * FULL_SWIPE_RATIO;
}

/**
 * 밀어서 드러나는 삭제 버튼. 버튼 폭보다 더 밀면 행을 따라 늘어나 틈을 메운다 —
 * "끝까지 밀면 지워진다"를 손끝에서 보여 주는 신호.
 */
function DeleteAction({
  translation,
  label,
  onPress,
}: {
  translation: SharedValue<number>;
  label: string;
  onPress: () => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const fill = useAnimatedStyle(() => ({
    width: Math.max(DELETE_ACTION_W, -translation.value - Spacing.two),
  }));
  return (
    <Animated.View style={[styles.deleteActionWrap, fill]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} 삭제`}
        style={[styles.deleteAction, { backgroundColor: t.danger }]}>
        <Text style={[Typography.label, { color: t.onPrimary }]}>삭제</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * 알림 행 스와이프 삭제 (#1137) — OS 알림 센터처럼 왼쪽으로 **끝까지 밀면 바로
 * 삭제**, 짧게 밀면 [삭제] 버튼이 남고 탭해야 지운다. 서버 삭제는 되돌릴 수 없다.
 * 예전의 스와이프 읽음(#560)은 이 동작으로 대체했고, 읽음은 행 탭으로 한다.
 *
 * 삭제 콜백이 없어도 **같은 Swipeable 트리**로 그린다(팬만 꺼짐) — 행 트리 모양이
 * 바뀌면 재마운트되며 RNGH 태그가 어긋나던 #1207과 같은 이유.
 */
function SwipeDeleteRow({
  entry,
  onDelete,
  children,
}: {
  entry: NotificationEntry;
  onDelete?: (id: number) => void;
  children: ReactNode;
}) {
  const swipeRef = useRef<SwipeableMethods>(null);
  // 놓는 순간 밀린 거리를 읽으려고 Swipeable이 넘겨주는 translation을 들고 있는다.
  // 열림 콜백(onSwipeableWillOpen)은 방향만 주기 때문이다.
  const translationRef = useRef<SharedValue<number> | null>(null);
  const [rowWidth, setRowWidth] = useState(0);
  return (
    <View
      testID={`notification-row-${entry.id}`}
      onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
      <ReanimatedSwipeable
        ref={swipeRef}
        testID={`notification-swipe-${entry.id}`}
        enabled={!!onDelete}
        rightThreshold={DELETE_ACTION_W / 2}
        onSwipeableWillOpen={() => {
          if (isFullSwipe(translationRef.current?.value ?? 0, rowWidth)) onDelete?.(entry.id);
        }}
        renderRightActions={
          onDelete
            ? (_progress, translation) => {
                translationRef.current = translation;
                return (
                  <DeleteAction
                    translation={translation}
                    label={entry.title}
                    onPress={() => {
                      swipeRef.current?.close();
                      onDelete(entry.id);
                    }}
                  />
                );
              }
            : undefined
        }>
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

/**
 * "알림" list screen (server GET /notifications): newest-first rows with an
 * unread accent dot; tapping an unread row marks it read, the header's 모두
 * 읽음 clears everything, swiping a row deletes it and 전체 삭제 empties the
 * inbox after a confirm. Pure + prop-driven.
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
  onDelete,
  onDeleteAll,
  onLoadMore,
}: NotificationListScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const Typography = useTypography();
  const entries = notifications ?? DEMO_NOTIFICATIONS;
  const hasUnread = entries.some((n) => !n.read);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader
        title="알림"
        onBack={onBack}
        right={
          entries.length > 0 ? (
            <View style={styles.headerActions}>
              {hasUnread ? (
                <Pressable
                  onPress={onReadAll}
                  accessibilityRole="button"
                  accessibilityLabel="모두 읽음"
                  style={[styles.headerBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.primaryText }]}>모두 읽음</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setConfirmDeleteAll(true)}
                accessibilityRole="button"
                accessibilityLabel="알림 전체 삭제"
                style={[styles.headerBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.danger }]}>전체 삭제</Text>
              </Pressable>
            </View>
          ) : undefined
        }
      />

      <FlatList
        data={entries}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.state}>
              <Loading />
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
          <SwipeDeleteRow entry={n} onDelete={onDelete}>
            <Pressable
              onPress={() => !n.read && onRead?.(n.id)}
              accessibilityRole="button"
              accessibilityLabel={n.title}
              accessibilityState={{ selected: !n.read }}
              // 스크린리더는 스와이프를 못 하니 행 동작으로 삭제를 연다.
              accessibilityActions={onDelete ? [{ name: 'delete', label: '삭제' }] : undefined}
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === 'delete') onDelete?.(n.id);
              }}
              style={[
                styles.row,
                { backgroundColor: n.read ? t.surfaceMuted : t.surface, borderColor: t.border },
              ]}>
              <View style={[styles.rowIcon, { backgroundColor: t.surfaceMuted }]}>
                <Icon name={notificationIcon(n.type)} size={18} color={t.text} />
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
          </SwipeDeleteRow>
        )}
      />

      <ConfirmDialog
        visible={confirmDeleteAll}
        title="알림을 모두 삭제할까요?"
        body="삭제한 알림은 되돌릴 수 없어요."
        confirmLabel="삭제"
        confirmAccessibilityLabel="알림 전체 삭제 확인"
        destructive
        onCancel={() => setConfirmDeleteAll(false)}
        onConfirm={() => {
          setConfirmDeleteAll(false);
          onDeleteAll?.();
        }}
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
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: Spacing.half,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  deleteActionWrap: {
    marginLeft: Spacing.two,
  },
  deleteAction: {
    flex: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerBtn: {
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
