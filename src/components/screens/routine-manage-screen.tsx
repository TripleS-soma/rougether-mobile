import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  ROUTINE_CATEGORIES,
  type Routine,
  type RoutineCategoryMeta,
  UNCATEGORIZED_META,
} from '@/constants/routines';
import { Icon } from '@/components/ui/icon';
import { Pictogram } from '@/components/ui/pictograms';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';
import { formatTime } from '@/utils/datetime';

export type RoutineManageScreenProps = {
  routines?: Routine[];
  categories?: RoutineCategoryMeta[];
  /** True while the routine data is loading (shows a spinner). */
  loading?: boolean;
  /** True when the load failed (shows an error + 다시 시도). */
  loadError?: boolean;
  /** Re-run the failed load. */
  onRetry?: () => void;
  onBack?: () => void;
  onAdd?: () => void;
  onEdit?: (routine: Routine) => void;
};

/**
 * Routine list grouped by category, ported from the prototype
 * `RoutineManageScreen`. Theme tokens + type scale; UI controls use `<Icon>`.
 */
export function RoutineManageScreen({
  routines = [],
  categories = ROUTINE_CATEGORIES,
  loading = false,
  loadError = false,
  onRetry,
  onBack,
  onAdd,
  onEdit,
}: RoutineManageScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const headerInset = useHeaderInsetStyle();
  // The routines prop carries the merged routine+todo list; this screen manages routines only.
  const routineItems = routines.filter((r) => r.kind !== 'todo');
  const knownIds = categories.map((c) => c.id);
  // With no categories, uncategorized routines still need a group to render in.
  const groups = categories.length > 0 ? categories : [UNCATEGORIZED_META];

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="back" size={26} color={t.text} />
          </Pressable>
          <Text style={[Typography.h2, { color: t.text }]}>루틴 관리</Text>
        </View>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="루틴 추가"
          style={[styles.iconBtn, { backgroundColor: t.primary }]}>
          <Icon name="add" size={20} color={t.onPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={t.primary} />
            <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
              불러오는 중…
            </Text>
          </View>
        ) : null}

        {!loading && loadError ? (
          <View style={styles.empty}>
            <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
              데이터를 불러오지 못했어요.
            </Text>
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
              style={[styles.retryBtn, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !loadError && routineItems.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
              아직 만든 루틴이 없어요.
            </Text>
            <View style={styles.emptyHint}>
              <Icon name="add" size={16} color={t.textMuted} />
              <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
                버튼으로 루틴을 추가해보세요.
              </Text>
            </View>
          </View>
        ) : null}

        {loading || loadError
          ? null
          : groups.map((cat, idx) => {
              const isFallback = idx === groups.length - 1;
              const items = routineItems.filter((r) => {
                if (r.category === cat.id) return true;
                return isFallback && (!r.category || !knownIds.includes(r.category));
              });
              if (items.length === 0) return null;

              return (
                <View key={cat.id} style={styles.group}>
                  <View style={styles.catHeader}>
                    <View style={[styles.catDot, { backgroundColor: `${cat.color}33` }]}>
                      <Pictogram name={cat.icon} size={14} />
                    </View>
                    <Text
                      style={[
                        Typography.label,
                        { color: readableTextColor(cat.color, t.surfaceMuted) },
                      ]}>
                      {cat.label}
                    </Text>
                    <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                      {items.length}
                    </Text>
                  </View>

                  <View style={styles.rows}>
                    {items.map((routine) => (
                      <Pressable
                        key={routine.id}
                        onPress={() => onEdit?.(routine)}
                        accessibilityRole="button"
                        style={[styles.row, { borderLeftColor: cat.color }]}>
                        <View style={styles.flex}>
                          <Text style={[Typography.body, { color: t.text }]}>{routine.title}</Text>
                          {(routine.alarmEnabled && routine.time) || routine.photoVerify ? (
                            <View style={styles.badges}>
                              {routine.alarmEnabled && routine.time ? (
                                <View style={styles.badge}>
                                  <Icon name="bell" size={11} color={t.textMuted} />
                                  <Text style={[styles.badgeText, { color: t.textMuted }]}>
                                    {formatTime(routine.time)}
                                  </Text>
                                </View>
                              ) : null}
                              {routine.photoVerify ? (
                                <View style={styles.badge}>
                                  <Icon name="camera" size={11} color={t.textMuted} />
                                  <Text style={[styles.badgeText, { color: t.textMuted }]}>
                                    사진 인증
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.chevron, { color: t.textDisabled }]}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.five,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
  retryBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  group: {
    gap: Spacing.half,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.half,
  },
  catDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
    paddingVertical: Spacing.one,
    // 부제 줄 유무와 무관한 고정 행 리듬 (#392) — 나의 방 리스트와 동일.
    minHeight: 48,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  badgeText: {
    fontSize: 11,
  },
  chevron: {
    fontSize: 20,
  },
});
