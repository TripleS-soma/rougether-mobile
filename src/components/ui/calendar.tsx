import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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
  const Typography = useTypography();
  const emph = useFontEmphasis();
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

  // 선택 원 슬라이드 (#452) — 원이 이전 날짜에서 새 날짜로 스프링 이동.
  // 셀은 7열 고정 격자라 (요일 헤더 1행 + firstWeekday 오프셋)로 좌표가
  // 결정된다. 다른 달로 넘어가면 원을 숨긴다.
  const [gridW, setGridW] = useState(0);
  const selPos = useRef(new Animated.ValueXY({ x: -999, y: -999 })).current;
  const selOpacity = useRef(new Animated.Value(0)).current;
  const selVisibleRef = useRef(false);
  const cellW = gridW / 7;
  const selectedInView = selected.y === view.y && selected.m === view.m;
  useEffect(() => {
    if (!gridW) return;
    if (!selectedInView) {
      selVisibleRef.current = false;
      Animated.timing(selOpacity, { toValue: 0, duration: 120, useNativeDriver: false }).start();
      return;
    }
    const gridIdx = 7 + firstWeekday + (selected.d - 1);
    const target = {
      x: (gridIdx % 7) * cellW + (cellW - 34) / 2,
      y: Math.floor(gridIdx / 7) * cellW + (cellW - 34) / 2,
    };
    if (!selVisibleRef.current) {
      // 처음 나타날 때(월 이동 직후 포함)는 점프 + 페이드 인.
      selVisibleRef.current = true;
      selPos.setValue(target);
      Animated.timing(selOpacity, { toValue: 1, duration: 140, useNativeDriver: false }).start();
      return;
    }
    Animated.spring(selPos, {
      toValue: target,
      friction: 7,
      tension: 90,
      useNativeDriver: false,
    }).start();
  }, [gridW, cellW, selectedInView, selected.d, firstWeekday, selPos, selOpacity]);

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

      <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.selCircle,
            {
              backgroundColor: t.primary,
              opacity: selOpacity,
              transform: selPos.getTranslateTransform(),
            },
          ]}
        />
        {WEEKDAYS.map((w, i) => (
          <View key={w} style={styles.cell}>
            <Text
              style={[
                styles.weekday,
                emph('semibold'),
                { color: i === 0 ? readableTextColor(t.danger, t.surfaceMuted) : t.textMuted },
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
              <View style={styles.dayCircle}>
                <Text
                  style={[
                    Typography.body,
                    {
                      color: disabled
                        ? t.textDisabled
                        : isSelected
                          ? t.onPrimary
                          : isSunday
                            ? t.danger
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
  },
  selCircle: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
