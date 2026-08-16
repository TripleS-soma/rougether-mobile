import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';
import { horizontalFlingGesture } from '@/utils/gesture';
import { useAnimatedValue, useAnimatedValueXY, useLatestRef } from '@/hooks/use-stable-value';

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
  /**
   * 그리드 가로 플링의 월 이동 (#562). 나의 방 달력 탭은 false — 거기선
   * 가로 스와이프가 방↔달력 탭 순환(#563 후속)이라 월 이동과 충돌한다.
   * 날짜 선택 시트들은 기본값(true) 그대로.
   */
  monthSwipe?: boolean;
  /**
   * 점을 찍을 날짜들 (#838) — "YYYY-MM-DD" 집합. 컴포넌트는 이게 무슨
   * 뜻인지 모르고 표시만 한다(호출부가 투두 있는 날만 넣는다). 없으면
   * 종전 그대로 — 날짜 선택 시트들은 점 없이 동작한다.
   */
  markedDates?: ReadonlySet<string>;
  /**
   * 보이는 달이 바뀔 때 "YYYY-MM" (#838) — 마운트 시 1회도 부른다. 부모가
   * 그 달 데이터를 받아 `markedDates`를 채우는 신호다. 달력이 스스로
   * 패칭하지 않는 건 순수 컴포넌트 규칙(AGENTS) 때문이다.
   */
  onVisibleMonthChange?: (yearMonth: string) => void;
};

/**
 * Compact month-grid date picker. Pure JS (no native module), so it ships over
 * EAS Update. ISO date strings sort lexicographically, so min/max comparisons
 * are plain string compares.
 */
function CalendarBase({
  value,
  min,
  max,
  onSelect,
  today,
  monthSwipe = true,
  markedDates,
  onVisibleMonthChange,
}: CalendarProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const selected = parse(value);
  const [view, setView] = useState({ y: selected.y, m: selected.m });

  // 보이는 달 알림 (#838) — 최신 콜백을 ref로 읽어, 부모가 인라인 함수를
  // 넘겨도 매 렌더 다시 부르지 않는다.
  const monthCbRef = useLatestRef(onVisibleMonthChange);
  useEffect(() => {
    monthCbRef.current?.(`${view.y}-${String(view.m + 1).padStart(2, '0')}`);
  }, [view.y, view.m, monthCbRef]);

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

  // 42칸 배열 + Date 2개를 매 렌더 다시 만들던 자리 (#771) — 보이는 달이
  // 바뀔 때만 계산한다.
  const cells = useMemo<(number | null)[]>(() => {
    const firstWeekday = new Date(view.y, view.m, 1).getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [view.y, view.m]);

  const shiftMonth = (delta: number) =>
    setView(({ y, m }) => {
      const next = m + delta;
      return { y: y + Math.floor(next / 12), m: ((next % 12) + 12) % 12 };
    });

  // 달력 월 스와이프 (#562) — 그리드의 가로 우세 플링으로 ‹ ›와 같은 이전/
  // 다음 달 이동. RNGH pan(#561과 공용 유틸) — RN 웹의 ScrollView 안에서
  // PanResponder는 move 클레임 질의를 못 받는다. 날짜 셀 탭은 활성 임계
  // (가로 24px) 미달이라 pan이 활성화되지 않아 그대로 살아 있다. shiftMonth는
  // 함수형 setState만 부르므로 첫 렌더 클로저로 충분하다. monthSwipe=false면
  // 비활성 — 플링이 부모 디텍터(방↔달력 순환)로 흘러간다. 사용처별 상수라
  // 마운트 시 1회 반영이면 충분하다.
  const monthFling = useRef(
    horizontalFlingGesture('calendar-month-fling', (dir) =>
      shiftMonth(dir === 'left' ? 1 : -1),
    ).enabled(monthSwipe),
  ).current;

  // 선택 원 슬라이드 (#452) — 원이 이전 날짜에서 새 날짜로 스프링 이동.
  // 원 좌표는 계산(cellW·행 높이 가정)이 아니라 각 날짜 셀이 onLayout으로
  // 보고한 실측 위치를 쓴다 — aspectRatio 셀 높이가 기기마다 gridW/7과
  // 정확히 일치하지 않아 세로가 한 행씩 어긋났다(#452 후속). 다른 달로
  // 넘어가면 원을 숨긴다.
  const selPos = useAnimatedValueXY({ x: -999, y: -999 });
  const selOpacity = useAnimatedValue(0);
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

      <GestureDetector gesture={monthFling}>
        <View style={styles.grid} testID="calendar-grid">
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
                  Typography.supporting,
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
                accessibilityLabel={markedDates?.has(date) ? `${date}, 할 일 있음` : date}
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
                      styles.dayText,
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
                {/* 할 일 있는 날 표시 (#838) — 선택된 날은 원이 이미 강조라
                    점을 생략하면 원 안에서 잉크가 겹쳐 지저분해진다. */}
                {markedDates?.has(date) && !isSelected ? (
                  <View
                    style={[styles.dot, { backgroundColor: disabled ? t.textDisabled : t.primary }]}
                  />
                ) : (
                  <View style={styles.dot} />
                )}
              </Pressable>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}
/**
 * memo (#771) — 42칸 + onLayout 클로저를 매번 다시 만들지 않게. 부모가
 * `onSelect`를 참조 고정으로 줘야 실제로 건너뛴다.
 */
export const Calendar = memo(CalendarBase);

const styles = StyleSheet.create({
  /** 날짜 아래 점 — 없을 때도 같은 크기의 자리를 잡아 줄 높이가 흔들리지 않게. */
  dot: {
    width: 4,
    height: 4,
    borderRadius: Radius.pill,
    marginTop: Spacing.half,
  },
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
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGlyph: {
    fontSize: 22,
    lineHeight: 24,
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
  // 날짜 숫자를 원 정중앙에 (#452 후속, iOS) — 커스텀 폰트의 비대칭
  // ascent/descent 때문에 타입 스케일 lineHeight 박스 안에서 iOS 글리프가
  // 아래로 쏠려 원과 어긋나 보였다. 라인박스를 원 높이로 맞추고(iOS는
  // 라인박스 중앙 배치), 안드로이드는 폰트 패딩을 제거해 동일 규칙으로.
  dayText: {
    lineHeight: SEL_SIZE,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
