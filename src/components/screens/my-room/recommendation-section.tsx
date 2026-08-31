import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RecommendationItem } from '@/api';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DAY_CODES, WEEKDAY_LABELS } from '@/constants/routines';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/** 서버 요일 토큰(MON~SUN) 목록 → '월 수 금'. 항상 일~토 순으로 다시 세운다. */
export function dayLabels(codes?: string[]): string {
  if (!codes?.length) return '';
  const picked = new Set(codes);
  return DAY_CODES.filter((c) => picked.has(c))
    .map((c) => WEEKDAY_LABELS[DAY_CODES.indexOf(c)])
    .join(' ');
}

/** 앱 요일 번호(0=일) 목록 → '월 수 금'. 변경 전 요일을 같은 표기로 그린다. */
export function dayLabelsFromNums(days?: number[]): string {
  if (!days?.length) return '';
  const picked = new Set(days);
  return WEEKDAY_LABELS.filter((_, i) => picked.has(i)).join(' ');
}

/**
 * 만료까지 남은 날 (#1006) — 수명이 7일이라 "언제까지 결정하면 되는지"가
 * 카드에서 바로 보여야 한다. 자정 경계로 세므로 시:분은 무시한다.
 */
export function daysLeftLabel(expiresAt?: string, now: Date = new Date()): string | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return null;
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(end) - startOfDay(now)) / 86400000);
  if (days < 0) return null;
  return days === 0 ? '오늘까지' : `D-${days}`;
}

export type RecommendationSectionProps = {
  items: RecommendationItem[];
  /** 처리 중인 추천 id — 그동안 버튼을 잠근다. */
  pendingId?: number | null;
  onAccept: (recommendationId: number) => void;
  onDismiss: (recommendationId: number) => void;
  /**
   * 대상 루틴의 현재 반복 요일 (서버 루틴 id → 앱 요일 번호). 있으면 카드가
   * '월 수 금 → 월 금'으로 변화를 보여주고, 없으면 제안 요일만 보여준다.
   */
  currentDaysById?: Record<number, number[] | undefined>;
  /** D-n 계산 기준 — 테스트가 고정한다. */
  now?: Date;
};

/**
 * AI 조정 추천 섹션 (#1006) — 주간회고 패널 하단에 붙는다.
 *
 * 문구(`message`)는 서버가 완성해 내려주므로 앱이 조립하지 않는다. 카드가
 * 더하는 건 **결정에 필요한 맥락**뿐이다: 어떤 루틴인지, 언제까지 유효한지,
 * 수락하면 요일이 어떻게 바뀌는지.
 *
 * 수락은 되돌릴 수 없어서(서버에 취소 API가 없다) 확인 다이얼로그를 한 번
 * 거친다. 무시는 루틴을 건드리지 않으므로 바로 처리한다.
 *
 * 순수/prop 기반 — 데이터 로딩·API 호출은 useRecommendations가 한다.
 */
export function RecommendationSection({
  items,
  pendingId = null,
  onAccept,
  onDismiss,
  currentDaysById,
  now,
}: RecommendationSectionProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const confirming = useMemo(
    () => items.find((r) => r.recommendationId === confirmId) ?? null,
    [items, confirmId],
  );

  if (items.length === 0) return null;

  const changeLine = (r: RecommendationItem) => {
    const after = dayLabels(r.proposal?.daysOfWeek);
    if (!after) return null;
    const before = dayLabelsFromNums(currentDaysById?.[r.routineId ?? -1]);
    return before && before !== after ? `${before} → ${after}` : after;
  };

  return (
    <View style={styles.section} testID="recommendation-section">
      <Text style={[Typography.label, { color: t.text }]}>조정 제안 {items.length}</Text>
      {items.map((r) => {
        const busy = pendingId != null;
        const left = daysLeftLabel(r.expiresAt, now);
        const change = changeLine(r);
        return (
          <View
            key={r.recommendationId}
            style={[styles.card, { backgroundColor: t.surfaceMuted }]}
            testID={`recommendation-${r.recommendationId}`}>
            <View style={styles.head}>
              <Text
                numberOfLines={1}
                style={[Typography.label, styles.headTitle, { color: t.text }]}>
                {r.routineTitle ?? '루틴'}
              </Text>
              {left ? (
                <Text style={[Typography.supporting, { color: t.textMuted }]}>{left}</Text>
              ) : null}
            </View>
            <Text style={[Typography.body, { color: t.text }]}>{r.message}</Text>
            {change ? (
              <View style={[styles.changeChip, { backgroundColor: t.surface }]}>
                <Text style={[Typography.supporting, emph('medium'), { color: t.primaryText }]}>
                  {change}
                </Text>
              </View>
            ) : null}
            <View style={styles.btns}>
              <Pressable
                onPress={() => onDismiss(r.recommendationId)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${r.routineTitle ?? '루틴'} 제안 무시`}
                accessibilityState={{ disabled: busy }}
                style={[styles.btn, { backgroundColor: t.surface, opacity: busy ? 0.5 : 1 }]}>
                <Text style={[Typography.label, { color: t.textMuted }]}>괜찮아요</Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmId(r.recommendationId)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${r.routineTitle ?? '루틴'} 제안 적용하기`}
                accessibilityState={{ disabled: busy }}
                style={[styles.btn, { backgroundColor: t.primary, opacity: busy ? 0.5 : 1 }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>적용하기</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {/* 수락은 루틴 스케줄을 실제로 바꾸고 되돌릴 수 없다 — 무엇이 어떻게
          바뀌는지 한 번 더 보여주고 받는다. */}
      <ConfirmDialog
        visible={confirming !== null}
        title="반복 요일을 바꿀까요?"
        body={
          confirming
            ? `${confirming.routineTitle ?? '루틴'}\n${changeLine(confirming) ?? ''}\n\n적용하면 되돌릴 수 없어요.`
            : ''
        }
        confirmLabel="적용"
        confirmAccessibilityLabel="제안 적용 확인"
        cancelAccessibilityLabel="제안 적용 취소"
        onConfirm={() => {
          const id = confirmId;
          setConfirmId(null);
          if (id != null) onAccept(id);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  card: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headTitle: { flex: 1 },
  changeChip: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  btns: { flexDirection: 'row', gap: Spacing.two },
  btn: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
