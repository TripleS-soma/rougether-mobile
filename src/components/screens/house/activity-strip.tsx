import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { shiftIso } from '@/utils/datetime';

export type ActivityStripDay = {
  /** "YYYY-MM-DD". */
  date: string;
  /** 표시용 날짜, 예: "8월 5일". */
  label: string;
  /** 그날 완료한 공개 루틴 제목들. */
  titles: string[];
};

/**
 * 축 길이는 **서버 계약에 묶여 있다** — `/routine-completions`가 최근 14일만
 * 준다. prop으로 열어두면 "최근 2주" 문구와 `N일` 카운터가 서로 다른 값을
 * 말할 수 있어(리뷰 지적) 조절 가능한 척하지 않는다.
 */
const SPAN_DAYS = 14;

export type ActivityStripProps = {
  /** 완료 기록이 있는 날들 (없는 날은 아예 안 온다). */
  days: ActivityStripDay[];
  /** 오늘 날짜 "YYYY-MM-DD" — 14칸 축의 오른쪽 끝. */
  today: string;
  /** 펼침 상태 — 부모가 소유한다(순수 컴포넌트). */
  expanded?: boolean;
  onToggle?: () => void;
};

/**
 * 친구의 최근 활동 스트립 (#860) — 카드 14장을 쌓던 섹션을 한 줄로 접었다.
 *
 * 친구 방에서 실제로 궁금한 건 "이 친구가 요즘 꾸준한가" 하나인데, 예전엔
 * 그 답을 얻으려고 카드를 훑어야 했고 그만큼 **방명록이 아래로 밀렸다.**
 * 점 하나가 하루고, 채워진 점이 공개 루틴을 하나라도 완료한 날이다.
 *
 * 서버는 **완료가 있는 날만** 보내므로 빈 날은 배열에 없다. 그래서 오늘부터
 * 거꾸로 14일 축을 직접 세우고 있는 날짜만 채운다 — 서버 배열 길이를 그대로
 * 쓰면 "쉰 날"이 사라져 추이가 실제보다 좋아 보인다.
 */
export function ActivityStrip({ days, today, expanded, onToggle }: ActivityStripProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  // 오래된 날 → 오늘 순. 오른쪽 끝이 오늘이라야 "최근"이 눈에 맞는다.
  const axis = useMemo(
    () =>
      Array.from({ length: SPAN_DAYS }, (_, i) => {
        const date = shiftIso(today, -(SPAN_DAYS - 1 - i));
        return { date, day: byDate.get(date) };
      }),
    [byDate, today],
  );
  const doneCount = axis.filter((a) => a.day && a.day.titles.length > 0).length;
  // 펼쳤을 때는 실제 기록이 있는 날만, 최신순으로 보여준다.
  const detail = useMemo(
    () => axis.filter((a) => a.day && a.day.titles.length > 0).reverse(),
    [axis],
  );

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: !!expanded }}
        accessibilityLabel={`최근 ${SPAN_DAYS}일 중 ${doneCount}일 완료, 눌러서 자세히 보기`}
        style={styles.row}>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>최근 2주</Text>
        <View style={styles.dots}>
          {axis.map(({ date, day }) => (
            <View
              key={date}
              style={[
                styles.dot,
                {
                  // 빈 칸은 surfaceMuted가 아니라 border다 — surfaceMuted는
                  // 카드 배경과 ΔE 3.7이라 **안 보인다**(주간회고의 긴 막대는
                  // 통짜라 견뎠지만, 8px 칸 14개로 쪼개면 프레임이 사라진다).
                  // border는 ΔE ~10으로 틀이 보이면서 데이터와 안 경쟁한다.
                  backgroundColor: day && day.titles.length > 0 ? t.primary : t.border,
                },
              ]}
            />
          ))}
        </View>
        {/* 점만으로는 값을 셀 수 없다 — 숫자를 함께 둔다. */}
        <Text style={[Typography.supporting, emph('semibold'), { color: t.textMuted }]}>
          {doneCount}/{SPAN_DAYS}일
        </Text>
      </Pressable>

      {expanded ? (
        detail.length === 0 ? (
          <Text style={[Typography.supporting, styles.empty, { color: t.textMuted }]}>
            최근 2주간 완료한 공개 루틴이 없어요.
          </Text>
        ) : (
          <View style={styles.detail}>
            {detail.map(({ date, day }) => (
              <View key={date} style={styles.detailRow}>
                <Text style={[Typography.supporting, styles.detailDate, { color: t.text }]}>
                  {day!.label}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[Typography.supporting, styles.detailTitles, { color: t.textMuted }]}>
                  {day!.titles.join(' · ')}
                </Text>
              </View>
            ))}
            <Text style={[Typography.supporting, { color: t.textDisabled }]}>
              공개 루틴만 표시돼요.
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dots: { flex: 1, flexDirection: 'row', gap: Spacing.half, alignItems: 'center' },
  dot: { flex: 1, height: Spacing.two, borderRadius: Radius.pill },
  empty: { paddingVertical: Spacing.one },
  detail: { gap: Spacing.one, paddingTop: Spacing.one },
  detailRow: { flexDirection: 'row', gap: Spacing.two },
  detailDate: { width: 64 },
  detailTitles: { flex: 1 },
});
