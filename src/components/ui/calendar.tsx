import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const SUNDAY = '#E89090';

type YMD = { y: number; m: number; d: number };

function parse(date: string): YMD {
  const [y, m, d] = date.split('-').map((v) => parseInt(v, 10));
  return { y, m: m - 1, d };
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export type CalendarProps = {
  /** Selected date, "YYYY-MM-DD". */
  value: string;
  /** Inclusive bounds, "YYYY-MM-DD". */
  min?: string;
  max?: string;
  onSelect: (date: string) => void;
};

/**
 * Compact month-grid date picker. Pure JS (no native module), so it ships over
 * EAS Update. ISO date strings sort lexicographically, so min/max comparisons
 * are plain string compares.
 */
export function Calendar({ value, min, max, onSelect }: CalendarProps) {
  const t = useTokens();
  const selected = parse(value);
  const [view, setView] = useState({ y: selected.y, m: selected.m });

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = (delta: number) =>
    setView(({ y, m }) => {
      const next = m + delta;
      return { y: y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 };
    });

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          style={[styles.navBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[styles.navGlyph, { color: t.text }]}>‹</Text>
        </Pressable>
        <Text style={[Typography.label, { color: t.text }]}>
          {view.y}년 {view.m + 1}월
        </Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          style={[styles.navBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[styles.navGlyph, { color: t.text }]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <View key={w} style={styles.cell}>
            <Text
              style={[
                styles.weekday,
                { color: i === 0 ? readableTextColor(SUNDAY, t.surfaceMuted) : t.textMuted },
              ]}>
              {w}
            </Text>
          </View>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <View key={`blank-${i}`} style={styles.cell} />;
          const date = iso(view.y, view.m, day);
          const disabled = (min && date < min) || (max && date > max);
          const isSelected = date === value;
          const isSunday = i % 7 === 0;
          return (
            <Pressable
              key={date}
              onPress={() => !disabled && onSelect(date)}
              disabled={!!disabled}
              accessibilityRole="button"
              accessibilityLabel={date}
              accessibilityState={{ selected: isSelected, disabled: !!disabled }}
              style={styles.cell}>
              <View style={[styles.dayCircle, isSelected && { backgroundColor: t.primary }]}>
                <Text
                  style={[
                    Typography.body,
                    {
                      color: disabled
                        ? t.textDisabled
                        : isSelected
                          ? t.onPrimary
                          : isSunday
                            ? SUNDAY
                            : t.text,
                    },
                  ]}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGlyph: {
    fontSize: 20,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
