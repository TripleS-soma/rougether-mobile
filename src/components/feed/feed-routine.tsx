import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  FeedCompletionPicker,
  FeedPostRoutine,
  FeedRoutineCompletion,
} from '@/components/screens/feed/types';
import { Icon } from '@/components/ui/icon';
import { Loading } from '@/components/ui/loading';
import { weekdayLabelKey } from '@/constants/routines';
import { FEED_ROUTINE_WINDOW_DAYS } from '@/constants/feed';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { i18n, useT } from '@/i18n';
import { shiftIso, todayIso, weekdayOf } from '@/utils/datetime';

const NO_PICKER: FeedCompletionPicker = { groups: [], loading: false, error: false };

/**
 * "2026-10-04" → "10/4" — 문자열을 그대로 읽는다(`new Date(iso)`의 UTC 해석·기기 시간대와
 * 무관하게 KST 달력 날짜 그대로 보이게). 깨진 값은 원문.
 */
export function feedRoutineDateLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  if (!m || !d) return date;
  return i18n.t('feed.routine.shortDate', { month: m, day: d });
}

/** 고르기의 날짜 묶음 제목 — 오늘 / 어제 / M/D. `today`는 KST 오늘. */
export function feedCompletionGroupLabel(date: string, today: string): string {
  if (date === today) return i18n.t('feed.routine.today');
  if (date === shiftIso(today, -1)) return i18n.t('feed.routine.yesterday');
  return feedRoutineDateLabel(date);
}

/** 인증글의 "✓ 아침 스트레칭 · 10/4 완료" 배지 (서버 #430). */
export function FeedRoutineBadge({ routine }: { routine: FeedPostRoutine }) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const date = feedRoutineDateLabel(routine.date);
  return (
    <View
      style={[styles.badge, { backgroundColor: t.primarySoft }]}
      accessible
      accessibilityLabel={tr('feed.routine.badgeA11y', { title: routine.title, date })}
      testID="feed-routine-badge">
      <Icon name="check" size={14} color={t.primaryText} />
      <Text
        style={[Typography.supporting, styles.shrink, { color: t.primaryText }]}
        numberOfLines={1}>
        {tr('feed.routine.badge', { title: routine.title, date })}
      </Text>
    </View>
  );
}

export type FeedRoutinePickerProps = {
  picker?: FeedCompletionPicker;
  value: FeedRoutineCompletion | null;
  onChange?: (value: FeedRoutineCompletion) => void;
  disabled?: boolean;
  /** KST 오늘(묶음 제목의 오늘·어제 판정) — 테스트·갤러리용, 기본 `todayIso()`. */
  today?: string;
};

/** 고르기의 날짜 줄 — KST 오늘을 끝으로 지난 7일(서버 허용 창과 같다). */
export function feedRoutineWindow(today: string): string[] {
  return Array.from({ length: FEED_ROUTINE_WINDOW_DAYS }, (_, i) =>
    shiftIso(today, i - (FEED_ROUTINE_WINDOW_DAYS - 1)),
  );
}

/**
 * 인증할 루틴 고르기 (#1456) — 최근 7일 주간 달력에서 날짜를 누르면 그날 완료한 루틴이 나오고,
 * 하나만 고른다(2026-10-06: 7일치를 한 줄로 쭉 늘어놓던 목록을 날짜 먼저 고르는 방식으로).
 * 완료가 있는 날에는 점이 찍힌다. 처음 펼친 날은 고른 루틴의 날짜, 없으면 가장 최근 완료일.
 * 순수·prop 기반: 목록은 셸이 `useRecentRoutineCompletions`로 넘긴다.
 */
export function FeedRoutinePicker({
  picker = NO_PICKER,
  value,
  onChange,
  disabled = false,
  today,
}: FeedRoutinePickerProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const kstToday = today ?? todayIso();
  const { groups, loading, error, onRetry } = picker;
  const days = feedRoutineWindow(kstToday);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  // 사용자가 누른 날 → 고른 루틴의 날 → 가장 최근 완료일 → 오늘.
  const shownDay =
    pickedDay ??
    (value && days.includes(value.date) ? value.date : null) ??
    groups[0]?.date ??
    kstToday;
  const byDate = new Map(groups.map((group) => [group.date, group.options]));
  const dayOptions = byDate.get(shownDay) ?? [];

  let body: ReactNode;
  if (groups.length === 0 && loading) {
    body = <Loading size="small" delayMs={0} />;
  } else if (groups.length === 0 && error) {
    body = (
      <View style={styles.state}>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('feed.routine.loadError')}
        </Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={[styles.retry, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.label, { color: t.primaryText }]}>{tr('app.ui.retry')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  } else if (groups.length === 0) {
    body = (
      <View style={[styles.state, styles.empty, { backgroundColor: t.surfaceMuted }]}>
        <Text style={[Typography.label, { color: t.text }]}>{tr('feed.routine.empty')}</Text>
        <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
          {tr('feed.routine.emptyHint')}
        </Text>
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.week} accessibilityRole="tablist" testID="feed-routine-week">
          {days.map((day) => {
            const count = byDate.get(day)?.length ?? 0;
            const active = day === shownDay;
            const label = feedCompletionGroupLabel(day, kstToday);
            return (
              <Pressable
                key={day}
                onPress={() => setPickedDay(day)}
                disabled={disabled}
                accessibilityRole="tab"
                accessibilityState={{ selected: active, disabled }}
                accessibilityLabel={tr('feed.routine.dayA11y', { label, count })}
                testID={`feed-routine-day-${day}`}
                style={[styles.day, active && { backgroundColor: t.primarySoft }]}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {tr(weekdayLabelKey(weekdayOf(day)))}
                </Text>
                <Text
                  style={[
                    Typography.label,
                    { color: active ? t.primaryText : count > 0 ? t.text : t.textMuted },
                  ]}>
                  {Number(day.slice(8))}
                </Text>
                <View
                  style={[styles.dot, { backgroundColor: count > 0 ? t.primary : 'transparent' }]}
                />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.group} testID={`feed-routine-group-${shownDay}`}>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('feed.routine.dayTitle', { label: feedCompletionGroupLabel(shownDay, kstToday) })}
          </Text>
          {dayOptions.length === 0 ? (
            <Text style={[Typography.supporting, styles.dayEmpty, { color: t.textMuted }]}>
              {tr('feed.routine.dayEmpty')}
            </Text>
          ) : (
            dayOptions.map((option) => {
              const selected = value?.routineId === option.routineId && value?.date === option.date;
              return (
                <Pressable
                  key={`${option.date}-${option.routineId}`}
                  onPress={() => onChange?.({ routineId: option.routineId, date: option.date })}
                  disabled={disabled || !onChange}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled }}
                  accessibilityLabel={tr('feed.routine.optionA11y', {
                    title: option.title,
                    date: feedRoutineDateLabel(option.date),
                  })}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? t.primarySoft : t.surfaceMuted,
                      borderColor: selected ? t.primary : t.surfaceMuted,
                    },
                  ]}>
                  <Icon
                    name={selected ? 'check' : 'checkbox-off'}
                    size={18}
                    color={selected ? t.primaryText : t.textMuted}
                  />
                  <Text
                    style={[Typography.body, styles.shrink, { color: t.text }]}
                    numberOfLines={1}>
                    {option.title}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </>
    );
  }

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" testID="feed-routine-picker">
      <Text style={[Typography.label, { color: t.text }]}>{tr('feed.routine.pickerTitle')}</Text>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        {tr('feed.routine.pickerHint')}
      </Text>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    maxWidth: '100%',
  },
  shrink: {
    flexShrink: 1,
  },
  center: {
    textAlign: 'center',
  },
  group: {
    gap: Spacing.one,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
    borderRadius: Radius.lg,
  },
  dot: {
    width: Spacing.one,
    height: Spacing.one,
    borderRadius: Radius.pill,
  },
  dayEmpty: {
    paddingVertical: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  state: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  empty: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  retry: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
});
