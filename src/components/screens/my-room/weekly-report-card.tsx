import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { SpringProgressBar } from '@/components/ui/spring-progress';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

export type WeeklyReportCardProps = {
  /** 회고 주 시작·종료일 (YYYY-MM-DD). */
  weekStartDate?: string;
  weekEndDate?: string;
  /** 0~1. */
  completionRate?: number;
  completedCount?: number;
  scheduledCount?: number;
  onPress?: () => void;
};

/** "2026-08-09" → "8월 9일". */
function shortDate(iso?: string) {
  const [, m, d] = (iso ?? '').split('-');
  return m && d ? `${Number(m)}월 ${Number(d)}일` : '';
}

/**
 * 달력 탭 상단의 주간 회고 진입 카드 (#852) — 지난주 완료율만 보여주고
 * 상세(통계 + LLM 본문)는 눌렀을 때 연다. 회고가 없는 주에는 부모가 아예
 * 렌더하지 않는다(빈 카드를 두지 않는다).
 */
export function WeeklyReportCard({
  weekStartDate,
  weekEndDate,
  completionRate = 0,
  completedCount = 0,
  scheduledCount = 0,
  onPress,
}: WeeklyReportCardProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const rate = Math.round(completionRate * 100);
  const period = `${shortDate(weekStartDate)} ~ ${shortDate(weekEndDate)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`주간 회고 열기, ${period}, 완료율 ${rate}퍼센트`}
      onPress={onPress}
      style={[styles.card, { backgroundColor: t.surfaceMuted, borderColor: t.border }]}>
      <View style={styles.head}>
        <Text style={[Typography.label, styles.title, { color: t.text }]}>주간 회고</Text>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>{period}</Text>
        <Icon name="forward" size={16} color={t.textDisabled} />
      </View>
      <SpringProgressBar
        progress={scheduledCount > 0 ? completedCount / scheduledCount : 0}
        color={t.primary}
        trackColor={t.surface}
        height={6}
      />
      {/* 막대 옆 숫자 — 카드에서도 값은 색이 아니라 글자로 읽힌다. */}
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        <Text style={emph('semibold')}>{rate}%</Text> · 예정 {scheduledCount}개 중 {completedCount}
        개 완료
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1 },
});
