import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';
import { horizontalFlingResponderConfig } from '@/utils/gesture';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 선택 원 지름 — 원 배치 계산과 스타일이 공유하는 단일 출처.
const SEL_SIZE = 34;

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
  /**
   * Today's date "YYYY-MM-DD" (#467). When set, a "오늘" chip in the month header
   * jumps the view + selection back to today — but only while off-today (a
   * different date is selected, or the view scrolled to another month). Omit
   * (date-picker sheets) to hide the chip entirely.
   */
  today?: string;
};

/**
 * Compact month-grid date picker. Pure JS (no native module), so it ships over
 * EAS Update. ISO date strings sort lexicographically, so min/max comparisons
 * are plain string compares.
 */
export function Calendar({ value, min, max, onSelect, today }: CalendarProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const selected = parse(value);
  const [view, setView] = useState({ y: selected.y, m: selected.m });

  // "오늘" 칩 (#467) — 오늘이 아닐 때(선택이 오늘이 아니거나, 뷰가 오늘 달을
  // 벗어났을 때)만 노출. 누르면 뷰와 선택을 오늘로 되돌린다.
  const todayYmd = today ? parse(today) : null;
  const showToday =
    todayYmd != null && (value !== today || view.y !== todayYmd.y || view.m !== todayYmd.m);
  const goToday = () => {
    if (!today || !todayYmd) return;
    setView({ y: todayYmd.y, m: todayYmd.m });
    onSelect(today);
  };

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

  // 달력 월 스와이프 (#562) — 그리드의 가로 우세 플링으로 ‹ ›와 같은 이전/
  // 다음 달 이동. 날짜 셀 탭은 클레임 임계(24px 가로 이동) 미달이라 그대로
  // 살아 있다. 판정은 #561과 공용 유틸(utils/gesture); shiftMonth는 함수형
  // setState만 부르므로 첫 렌더 클로저로 충분하다.
  const monthSwipePan = useRef(
    PanResponder.create(
      horizontalFlingResponderConfig((dir) => shiftMonth(dir === 'left' ? 1 : -1)),
    ),
  ).current;

  // 선택 원 슬라이드 (#452) — 원이 이전 날짜에서 새 날짜로 스프링 이동.
  // 원 좌표는 계산(cellW·행 높이 가정)이 아니라 각 날짜 셀이 onLayout으로
  // 보고한 실측 위치를 쓴다 — aspectRatio 셀 높이가 기기마다 gridW/7과
  // 정확히 일치하지 않아 세로가 한 행씩 어긋났다(#452 후속). 다른 달로
  // 넘어가면 원을 숨긴다.
  const selPos = useRef(new Animated.ValueXY({ x: -999, y: -999 })).current;
  const selOpacity = useRef(new Animated.Value(0)).current;
  const selVisibleRef = useRef(false);
  const dayLayouts = useRef<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({});
  const selectedInView = selected.y === view.y && selected.m === view.m;
  // 실측 셀 위치로 원을 놓는다. appearing(첫 등장·월 이동 복귀)이면 점프+페이드,
  // 같은 달 내 재선택이면 스프링. 셀이 아직 측정 전이면 no-op(onLayout이 뒤이어 호출).
  const placeCircle = (animate: boolean) => {
    const l = dayLayouts.current[value];
    if (!l) return;
    const target = { x: l.x + (l.width - SEL_SIZE) / 2, y: l.y + (l.height - SEL_SIZE) / 2 };
    const appearing = !selVisibleRef.current;
    if (appearing || !animate) {
      selPos.setValue(target);
    } else {
      Animated.spring(selPos, {
        toValue: target,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }
    if (appearing) {
      selVisibleRef.current = true;
      Animated.timing(selOpacity, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    }
  };
  useEffect(() => {
    if (!selectedInView) {
      selVisibleRef.current = false;
      Animated.timing(selOpacity, { toValue: 0, duration: 120, useNativeDriver: true }).start();
      return;
    }
    placeCircle(true);
    // placeCircle은 렌더마다 새로 만들어지는 클로저 — value/selectedInView만 의존.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectedInView]);

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
        <View style={styles.headCenter}>
          <Text style={[Typography.label, { color: t.text }]}>
            {view.y}년 {view.m + 1}월
          </Text>
          {showToday ? (
            <Pressable
              onPress={goToday}
              accessibilityRole="button"
              accessibilityLabel="오늘로"
              style={[styles.todayChip, { backgroundColor: t.primarySoft }]}>
              <Text style={[Typography.supporting, emph('semibold'), { color: t.primaryText }]}>
                오늘
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => shiftMonth(1)}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          style={[styles.navBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[styles.navGlyph, { color: t.text }]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.grid} testID="calendar-grid" {...monthSwipePan.panHandlers}>
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
              onLayout={(e) => {
                dayLayouts.current[date] = e.nativeEvent.layout;
                // 월 이동으로 이 셀이 새로 측정될 때, 선택 날짜면 즉시 원을 얹는다.
                if (date === value && selectedInView) placeCircle(false);
              }}
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
  headCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  todayChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
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
    width: SEL_SIZE,
    height: SEL_SIZE,
    borderRadius: SEL_SIZE / 2,
  },
  dayCircle: {
    width: SEL_SIZE,
    height: SEL_SIZE,
    borderRadius: SEL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
