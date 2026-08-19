import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BearCheck } from '@/components/ui/bear-check';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import type { DeviceCalendar } from '@/lib/device-calendar';
import type { ImportCandidate, ImportOutcome } from '@/hooks/use-calendar-import';

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
  return m && d ? `${Number(m)}월 ${Number(d)}일` : iso;
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
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [picked, setPicked] = useState<string[]>([]);
  /**
   * 사용자가 **기본값을 뒤집은** 일정 id. 기본은 "가져옴"이되 비슷한 게 이미
   * 있으면 기본 해제다 — 그래서 집합 멤버십을 곧 "꺼짐"으로 읽으면 안 된다
   * (그러면 기본 해제된 항목을 다시 켤 수 없다).
   */
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  const defaultOn = (c: ImportCandidate) => c.similar.length === 0;
  const isOn = (c: ImportCandidate) => (flipped.has(c.id) ? !defaultOn(c) : defaultOn(c));
  const toggle = (c: ImportCandidate) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.add(c.id);
      return next;
    });
  const selected = (candidates ?? []).filter(isOn);

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="캘린더 연동" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          기기 캘린더의 오늘 이후 {'→'} 30일 일정을 할 일로 가져와요. 캘린더에 쓰지 않고 읽기만
          해요.
        </Text>

        {denied ? (
          <Text style={[Typography.body, { color: t.danger }]}>
            캘린더 접근이 꺼져 있어요. 기기 설정에서 루게더의 캘린더 권한을 켜주세요.
          </Text>
        ) : null}

        {calendars == null ? (
          <Button label="캘린더 연결하기" onPress={onConnect} />
        ) : calendars.length === 0 && !denied ? (
          <Text style={[Typography.body, { color: t.textMuted }]}>
            읽을 수 있는 캘린더가 없어요.
          </Text>
        ) : (
          <>
            <Text style={[Typography.label, { color: t.text }]}>가져올 캘린더</Text>
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
                  accessibilityLabel={`캘린더 ${c.title}`}
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
              label="일정 불러오기"
              onPress={() => onPreview?.(picked)}
              disabled={picked.length === 0 || busy}
            />
          </>
        )}

        {busy ? <Loading /> : null}

        {candidates != null && !busy ? (
          candidates.length === 0 ? (
            <Text style={[Typography.body, { color: t.textMuted }]}>
              앞으로 30일 안에 가져올 일정이 없어요.
            </Text>
          ) : (
            <>
              <Text style={[Typography.label, { color: t.text }]}>
                가져올 일정 ({selected.length}/{candidates.length})
              </Text>
              {!embeddingApplied ? (
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  지금은 제목이 똑같은 것만 겹침으로 표시돼요.
                </Text>
              ) : null}
              {candidates.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => toggle(c)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isOn(c) }}
                  accessibilityLabel={
                    c.similar.length > 0
                      ? `${c.title}, ${shortDate(c.date)}, 비슷한 항목 있음`
                      : `${c.title}, ${shortDate(c.date)}`
                  }
                  style={[styles.row, { backgroundColor: t.surfaceMuted }]}>
                  <BearCheck checked={isOn(c)} size={20} />
                  <View style={styles.flex}>
                    <Text style={[Typography.label, { color: t.text }]} numberOfLines={1}>
                      {c.title}
                    </Text>
                    {c.similar.length > 0 ? (
                      <Text style={[Typography.supporting, { color: t.warningText }]}>
                        비슷한 {c.similar[0].kind === 'ROUTINE' ? '루틴' : '할 일'}이 있어요 ·{' '}
                        {c.similar[0].title}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[Typography.supporting, emph('normal'), { color: t.textMuted }]}>
                    {shortDate(c.date)}
                  </Text>
                </Pressable>
              ))}
              <Button
                label={`${selected.length}개 가져오기`}
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
  flex: { flex: 1 },
});
