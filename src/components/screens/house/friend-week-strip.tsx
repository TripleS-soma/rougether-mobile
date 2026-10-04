import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { Icon } from '@/components/ui/icon';
import { weekdayLabelKey } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { shiftIso } from '@/utils/datetime';
import { horizontalFlingGesture } from '@/utils/gesture';

/** 그 날짜가 속한 주의 일요일 ("YYYY-MM-DD"). 날짜 문자열만 다뤄 기기 시간대와 무관하다. */
export function weekStartOf(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  // 요일 계산만 — UTC 정오로 만들어 어느 시간대에서도 날짜가 밀리지 않는다.
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return shiftIso(dateIso, -dow);
}

export type FriendWeekStripProps = {
  /** 선택된 날짜 "YYYY-MM-DD". 이 날짜가 속한 주를 보여준다. */
  selected: string;
  /** 오늘(KST) — 미래 날짜는 점을 찍지 않는다. */
  today: string;
  /** 날짜별 완료 개수 — 1 이상이면 ●, 0/없음이면 ○. undefined면 점을 숨긴다(기록을 못 받음). */
  doneCounts?: Record<string, number>;
  onSelect: (date: string) => void;
};

/**
 * 친구 방 주간 날짜 줄 (#1423) — 투두메이트식 일–토 7칸. 날짜를 누르면 그날 목록,
 * ‹ › 또는 좌우 플링으로 한 주씩 이동한다(이동하면 같은 요일을 선택). 순수 컴포넌트.
 */
export function FriendWeekStrip({ selected, today, doneCounts, onSelect }: FriendWeekStripProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const start = weekStartOf(selected);
  const days = Array.from({ length: 7 }, (_, i) => shiftIso(start, i));
  const end = days[6];
  const [, sm, sd] = start.split('-').map(Number);
  const [, em, ed] = end.split('-').map(Number);

  // 플링 핸들러는 최신 값을 ref로 읽어 제스처를 재생성하지 않는다(#539 결).
  const shiftRef = useRef<(dir: 'left' | 'right') => void>(() => {});
  shiftRef.current = (dir) => onSelect(shiftIso(selected, dir === 'left' ? 7 : -7));
  const fling = useRef(
    horizontalFlingGesture('friend-week-fling', (dir) => shiftRef.current(dir)),
  ).current;

  return (
    <GestureDetector gesture={fling}>
      <View
        style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.border }]}
        collapsable={false}>
        <View style={styles.head}>
          <Pressable
            onPress={() => onSelect(shiftIso(selected, -7))}
            accessibilityRole="button"
            accessibilityLabel={tr('routineTodo.calendar.prevWeek')}
            hitSlop={Spacing.two}
            style={styles.arrow}>
            <Icon name="back" size={18} color={t.textMuted} />
          </Pressable>
          <Text style={[Typography.label, { color: t.text }]}>
            {tr('house.friendWeek.range', { sm, sd, em, ed })}
          </Text>
          <Pressable
            onPress={() => onSelect(shiftIso(selected, 7))}
            accessibilityRole="button"
            accessibilityLabel={tr('routineTodo.calendar.nextWeek')}
            hitSlop={Spacing.two}
            style={styles.arrow}>
            <Icon name="forward" size={18} color={t.textMuted} />
          </Pressable>
        </View>
        <View style={styles.row}>
          {days.map((date, i) => {
            const isSelected = date === selected;
            const isToday = date === today;
            const future = date > today;
            const done = doneCounts?.[date] ?? 0;
            const showDot = doneCounts !== undefined && !future;
            const dayNum = Number(date.slice(8));
            const weekday = tr(weekdayLabelKey(i));
            const a11y = [
              date,
              isToday ? tr('routineTodo.calendar.today') : null,
              showDot
                ? done > 0
                  ? tr('house.friendWeek.done', { n: done })
                  : tr('house.friendWeek.none')
                : null,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <Pressable
                key={date}
                onPress={() => onSelect(date)}
                accessibilityRole="button"
                accessibilityLabel={a11y}
                accessibilityState={{ selected: isSelected }}
                aria-selected={isSelected}
                style={styles.cell}>
                <Text
                  style={[
                    Typography.supporting,
                    emph('normal'),
                    { color: i === 0 ? t.danger : t.textMuted },
                  ]}>
                  {weekday}
                </Text>
                <View
                  style={[
                    styles.dayCircle,
                    isSelected
                      ? { backgroundColor: t.primary }
                      : isToday
                        ? { borderColor: t.primary, borderWidth: Spacing.half }
                        : null,
                  ]}>
                  <Text
                    style={[
                      Typography.label,
                      { color: isSelected ? t.onPrimary : future ? t.textMuted : t.text },
                    ]}>
                    {dayNum}
                  </Text>
                </View>
                <View
                  testID={`friend-week-dot-${date}`}
                  style={[
                    styles.dot,
                    showDot
                      ? done > 0
                        ? { backgroundColor: t.primary }
                        : { borderColor: t.border, borderWidth: Spacing.half }
                      : null,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </GestureDetector>
  );
}

const DAY = Spacing.five;
const DOT = Spacing.two;

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  arrow: { padding: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { flex: 1, alignItems: 'center', gap: Spacing.one },
  dayCircle: {
    width: DAY,
    height: DAY,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT, height: DOT, borderRadius: Radius.pill },
});
