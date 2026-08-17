import { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Loading } from '@/components/ui/loading';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SpringProgressBar } from '@/components/ui/spring-progress';
import { Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import type { WeeklyReportDetailResponse } from '@/api/types';

/**
 * 요일 표시 순서 — 서버가 주는 배열 순서를 믿지 않고 일~토로 직접 세운다.
 * 달력 탭의 요일 머리글과 같은 순서라야 눈이 같은 자리를 찾는다.
 */
const WEEKDAYS = [
  { key: 'SUNDAY', label: '일' },
  { key: 'MONDAY', label: '월' },
  { key: 'TUESDAY', label: '화' },
  { key: 'WEDNESDAY', label: '수' },
  { key: 'THURSDAY', label: '목' },
  { key: 'FRIDAY', label: '금' },
  { key: 'SATURDAY', label: '토' },
] as const;

/** "2026-08-09" → "8월 9일". 연도는 기간 한 줄에서 반복할 필요가 없다. */
function shortDate(iso?: string) {
  const [, m, d] = (iso ?? '').split('-');
  return m && d ? `${Number(m)}월 ${Number(d)}일` : '';
}

export type WeeklyReportScreenProps = {
  report?: WeeklyReportDetailResponse | null;
  loading?: boolean;
  onBack?: () => void;
};

/**
 * 주간 회고 상세 (#852) — 서버가 주 단위로 만들어 두는 회고. 위에서부터
 * 완료율(숫자 하나) → 요일별·루틴별 비율 막대 → LLM 본문 순.
 *
 * 막대를 완료/실패 두 색으로 쌓지 않는 이유: 서버 데이터가 항상
 * `completed + failed = scheduled`라 **한 계열의 비율**이지 두 계열의 경쟁이
 * 아니다. 채움(primary)만 데이터고 트랙(surfaceMuted)은 "예정된 전체"라
 * 범례가 필요 없다. 대신 칸마다 `완료/전체` 숫자를 직접 붙인다 — 채움색과
 * 배경의 대비가 3:1 미만이라 색만으로 값을 읽게 두면 안 된다.
 *
 * 순수/prop 기반 — 데이터 로딩은 useWeeklyReport가 한다.
 */
export function WeeklyReportScreen({ report, loading, onBack }: WeeklyReportScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();

  const stats = report?.stats;
  const byWeekday = useMemo(() => {
    const found = new Map((stats?.byWeekday ?? []).map((w) => [w.dayOfWeek, w]));
    return WEEKDAYS.map(({ key, label }) => {
      const done = found.get(key)?.completed ?? 0;
      const failed = found.get(key)?.failed ?? 0;
      return { label, done, total: done + failed };
    });
  }, [stats?.byWeekday]);

  // 완료 많은 루틴부터 — 목록이 길어도 위에서 성과가 먼저 읽힌다.
  const byRoutine = useMemo(
    () =>
      [...(stats?.byRoutine ?? [])]
        .map((r) => ({
          key: String(r.lineageId ?? r.title),
          title: r.title ?? '이름 없는 루틴',
          category: r.categoryName,
          done: r.completed ?? 0,
          total: (r.completed ?? 0) + (r.failed ?? 0),
        }))
        .sort((a, b) => b.done - a.done || b.total - a.total),
    [stats?.byRoutine],
  );

  const scheduled = report?.scheduledCount ?? 0;
  const completed = report?.completedCount ?? 0;
  const rate = Math.round((report?.completionRate ?? 0) * 100);
  const period = `${shortDate(report?.weekStartDate)} ~ ${shortDate(report?.weekEndDate)}`;
  // FALLBACK = LLM 생성이 실패해 통계만 있는 회고. 본문 자리에 빈 제목만
  // 늘어놓는 대신 접고 이유를 밝힌다.
  const hasText = report?.status !== 'FALLBACK';

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="주간 회고" onBack={onBack} />
      {loading || !report ? (
        <View style={styles.stateBlock}>{loading ? <Loading /> : null}</View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>{period}</Text>

          {/* 헤드라인은 차트가 아니라 숫자 하나 — 이 주를 한 마디로 말하는 값. */}
          <View style={[styles.hero, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[Typography.display1, emph('bold'), { color: t.primaryText }]}>
              {rate}%
            </Text>
            <Text style={[Typography.body, { color: t.textMuted }]}>
              예정 {scheduled}개 중 {completed}개 완료
            </Text>
            {stats?.streak ? (
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                연속 {stats.streak.currentCount ?? 0}일 · 최장 {stats.streak.longestCount ?? 0}일
              </Text>
            ) : null}
          </View>

          {report.summary ? (
            <Text style={[Typography.body, { color: t.text }]}>{report.summary}</Text>
          ) : null}

          <ReportSection title="요일별">
            {byWeekday.map((d) => (
              <WeekdayRow key={d.label} label={d.label} done={d.done} total={d.total} />
            ))}
          </ReportSection>

          {byRoutine.length > 0 ? (
            <ReportSection title="루틴별">
              {byRoutine.map(({ key, ...r }) => (
                <RoutineRow key={key} {...r} />
              ))}
            </ReportSection>
          ) : null}

          {hasText ? (
            <>
              <TextSection title="잘한 점" items={report.highlights} />
              <TextSection title="아쉬운 점" items={report.failurePatterns} />
              <TextSection title="다음 주 제안" items={report.suggestions} />
            </>
          ) : (
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              이번 주는 회고 문구를 만들지 못해 통계만 보여드려요.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.section}>
      <Text style={[Typography.h3, { color: t.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function TextSection({ title, items }: { title: string; items?: string[] }) {
  const t = useTokens();
  const Typography = useTypography();
  if (!items || items.length === 0) return null;
  return (
    <ReportSection title={title}>
      {items.map((line, i) => (
        <View key={`${title}-${i}`} style={styles.bulletRow}>
          <Text style={[Typography.body, { color: t.textMuted }]}>·</Text>
          <Text style={[Typography.body, styles.bulletText, { color: t.text }]}>{line}</Text>
        </View>
      ))}
    </ReportSection>
  );
}

function WeekdayRow({ label, done, total }: { label: string; done: number; total: number }) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View
      style={styles.statRow}
      accessibilityLabel={
        total > 0 ? `${label}요일 ${total}개 중 ${done}개 완료` : `${label}요일 예정 없음`
      }>
      <Text style={[Typography.label, styles.weekdayLabel, { color: t.textMuted }]}>{label}</Text>
      <SpringProgressBar
        progress={total > 0 ? done / total : 0}
        color={t.primary}
        trackColor={t.surfaceMuted}
        style={styles.statBar}
      />
      {/* 직접 라벨 — 채움색 대비가 3:1 미만이라 색만으로 값을 읽게 두지 않는다. */}
      <Text style={[Typography.supporting, styles.statValue, { color: t.textMuted }]}>
        {total > 0 ? `${done}/${total}` : '—'}
      </Text>
    </View>
  );
}

function RoutineRow({
  title,
  category,
  done,
  total,
}: {
  title: string;
  category?: string;
  done: number;
  total: number;
}) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.routineRow} accessibilityLabel={`${title}, ${total}개 중 ${done}개 완료`}>
      <View style={styles.routineHead}>
        <Text numberOfLines={1} style={[Typography.label, styles.routineTitle, { color: t.text }]}>
          {title}
        </Text>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {done}/{total}
        </Text>
      </View>
      {category ? (
        <Text style={[Typography.supporting, { color: t.textMuted }]}>{category}</Text>
      ) : null}
      <SpringProgressBar
        progress={total > 0 ? done / total : 0}
        color={t.primary}
        trackColor={t.surfaceMuted}
        height={6}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  stateBlock: { paddingVertical: Spacing.five, alignItems: 'center' },
  hero: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
  },
  section: { gap: Spacing.two },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  weekdayLabel: { width: 24 },
  statBar: { flex: 1 },
  // 숫자 열 폭을 고정해 막대 끝이 값마다 들쭉날쭉해지지 않게 한다.
  statValue: { width: 44, textAlign: 'right' },
  routineRow: { gap: Spacing.one },
  routineHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  routineTitle: { flex: 1 },
  bulletRow: { flexDirection: 'row', gap: Spacing.two },
  bulletText: { flex: 1 },
});
