import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BearCheck } from '@/components/ui/bear-check';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import type { DeviceCalendar } from '@/lib/device-calendar';
import type { ImportCandidate, ImportOutcome } from '@/hooks/use-calendar-import';
import { i18n, useT } from '@/i18n';

/**
 * 반복 배지 문구 (#952). 이 표시가 붙은 일정은 회차마다 투두가 아니라
 * **루틴 하나**로 들어간다 — 가져오면 뭐가 생기는지 예측 가능해야 한다.
 * 서버가 못 담는 반복은 `repeat`이 비어 있어 배지도 안 붙는다(회차 투두).
 */
function repeatLabel(repeat: NonNullable<ImportCandidate['repeat']>): string {
  return i18n.t(`member.calendarImport.repeat.${repeat}`);
}

export type CalendarImportScreenProps = {
  /** null = 아직 연결 전(권한 요청 안 함). */
  calendars?: DeviceCalendar[] | null;
  /** null = 아직 미리보기 전. */
  candidates?: ImportCandidate[] | null;
  busy?: boolean;
  /** 권한이 거부된 상태 — 설정에서 켜라고 안내한다. */
  denied?: boolean;
  /** 유사 힌트가 임베딩까지 쓴 결과인지. false면 정규화 일치만 본 것. */
  embeddingApplied?: boolean;
  onConnect?: () => void;
  onPreview?: (calendarIds: string[]) => void;
  onImport?: (selected: ImportCandidate[]) => Promise<ImportOutcome | void> | void;
  onBack?: () => void;
};

/** "2026-08-20" → "8월 20일". */
function shortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return m && d
    ? i18n.t('member.calendarImport.shortDate', { month: Number(m), day: Number(d) })
    : iso;
}

/**
 * 캘린더 연동 (#844) — 기기 캘린더(구글 등)의 **오늘 이후** 일정을 골라
 * 투두로 가져온다. 읽기 전용이라 캘린더에 쓰지 않는다.
 *
 * **통째로 가져오지 않고 고르게 한다**: 캘린더엔 공휴일·구독 일정·회의가
 * 섞여 있고, 서버가 **지운 조합을 재등록해주지 않아** 잘못 가져온 걸 지우면
 * 되돌릴 수 없다. 비슷한 루틴·투두가 이미 있는 항목은 기본 해제해 둔다.
 *
 * 순수/prop 기반 — 권한·조회·임포트는 useCalendarImport가 한다.
 */
export function CalendarImportScreen({
  calendars,
  candidates,
  busy,
  denied,
  embeddingApplied = true,
  onConnect,
  onPreview,
  onImport,
  onBack,
}: CalendarImportScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const tr = useT();
  const [picked, setPicked] = useState<string[]>([]);
  /**
   * 사용자가 **기본값을 뒤집은** 일정 id. 기본은 "가져옴"이되 비슷한 게 이미
   * 있으면 기본 해제다 — 그래서 집합 멤버십을 곧 "꺼짐"으로 읽으면 안 된다
   * (그러면 기본 해제된 항목을 다시 켤 수 없다).
   */
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  const defaultOn = (c: ImportCandidate) => c.similar.length === 0;
  const isOn = (c: ImportCandidate) => (flipped.has(c.occurrenceId) ? !defaultOn(c) : defaultOn(c));
  const toggle = (c: ImportCandidate) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(c.occurrenceId)) next.delete(c.occurrenceId);
      else next.add(c.occurrenceId);
      return next;
    });
  const selected = (candidates ?? []).filter(isOn);

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title={tr('member.calendarImport.title')} onBack={onBack} />
      <ScrollView
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('member.calendarImport.intro')}
        </Text>

        {denied ? (
          <Text style={[Typography.body, { color: t.danger }]}>
            {tr('member.calendarImport.denied')}
          </Text>
        ) : null}

        {calendars == null ? (
          <Button label={tr('member.calendarImport.connect')} onPress={onConnect} />
        ) : calendars.length === 0 && !denied ? (
          <Text style={[Typography.body, { color: t.textMuted }]}>
            {tr('member.calendarImport.noCalendars')}
          </Text>
        ) : (
          <>
            <Text style={[Typography.label, { color: t.text }]}>
              {tr('member.calendarImport.pickCalendars')}
            </Text>
            {calendars.map((c) => {
              const on = picked.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() =>
                    setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={tr('member.calendarImport.calendarA11y', { title: c.title })}
                  style={[styles.row, { backgroundColor: t.surfaceMuted }]}>
                  <BearCheck checked={on} size={20} />
                  <View style={styles.flex}>
                    <Text style={[Typography.label, { color: t.text }]}>{c.title}</Text>
                    {c.source ? (
                      <Text style={[Typography.supporting, { color: t.textMuted }]}>
                        {c.source}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            <Button
              label={tr('member.calendarImport.preview')}
              onPress={() => onPreview?.(picked)}
              disabled={picked.length === 0 || busy}
            />
          </>
        )}

        {busy ? <Loading /> : null}

        {candidates != null && !busy ? (
          candidates.length === 0 ? (
            <Text style={[Typography.body, { color: t.textMuted }]}>
              {tr('member.calendarImport.noEvents')}
            </Text>
          ) : (
            <>
              <Text style={[Typography.label, { color: t.text }]}>
                {tr('member.calendarImport.pickEvents', {
                  selected: selected.length,
                  total: candidates.length,
                })}
              </Text>
              {!embeddingApplied ? (
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {tr('member.calendarImport.exactOnly')}
                </Text>
              ) : null}
              {candidates.map((c) => (
                <Pressable
                  key={c.occurrenceId}
                  onPress={() => toggle(c)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isOn(c) }}
                  accessibilityLabel={[
                    c.title,
                    shortDate(c.date),
                    c.repeat ? repeatLabel(c.repeat) : null,
                    c.similar.length > 0 ? tr('member.calendarImport.similarA11y') : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  style={[styles.row, { backgroundColor: t.surfaceMuted }]}>
                  <BearCheck checked={isOn(c)} size={20} />
                  <View style={styles.flex}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[Typography.label, styles.flex, { color: t.text }]}
                        numberOfLines={1}>
                        {c.title}
                      </Text>
                      {c.repeat ? (
                        <View
                          testID={`repeat-badge-${c.occurrenceId}`}
                          style={[styles.repeatBadge, { backgroundColor: t.primarySoft }]}>
                          <Text style={[Typography.supporting, { color: t.primaryText }]}>
                            {repeatLabel(c.repeat)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {c.similar.length > 0 ? (
                      <Text style={[Typography.supporting, { color: t.warningText }]}>
                        {tr('member.calendarImport.similarExists', {
                          kind:
                            c.similar[0].kind === 'ROUTINE'
                              ? tr('member.calendarImport.kindRoutine')
                              : tr('member.calendarImport.kindTodo'),
                          title: c.similar[0].title,
                        })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[Typography.supporting, emph('normal'), { color: t.textMuted }]}>
                    {shortDate(c.date)}
                  </Text>
                </Pressable>
              ))}
              <Button
                label={tr('member.calendarImport.import', { count: selected.length })}
                onPress={() => onImport?.(selected)}
                disabled={selected.length === 0 || busy}
              />
            </>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.five },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  repeatBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
  },
  flex: { flex: 1 },
});
