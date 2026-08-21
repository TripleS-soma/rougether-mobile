/**
 * 기기 캘린더 임포트 (#844) — 권한 → 캘린더 선택 → 창 조회 → 유사 힌트 →
 * 선택 임포트.
 *
 * **미리보기 후 선택**이 기본이다: 캘린더에는 공휴일·구독 일정·회의가 섞여
 * 있어서 통째로 가져오면 지우는 게 일이 된다. 게다가 서버가 **지운 조합을
 * 재등록해주지 않으므로** 잘못 가져온 걸 지우면 되돌릴 수 없다.
 *
 * 반환 객체는 useMemo, 액션은 useCallback — memo 경계(#539)를 뚫지 않게.
 */
import { useCallback, useMemo, useState } from 'react';

import {
  ApiError,
  ErrorCode,
  fetchSimilarity,
  importCalendarRoutine,
  importCalendarTodo,
} from '@/api';
import type { SimilarHit } from '@/api/calendar-import';
import {
  type DeviceCalendar,
  type DeviceEvent,
  listDeviceCalendars,
  readUpcomingEvents,
  requestCalendarAccess,
} from '@/lib/device-calendar';

/** 서버가 값을 해석하지 않지만, 출처를 남겨야 나중에 구분할 수 있다. */
export const EXTERNAL_SOURCE = 'DEVICE_CALENDAR';

export type ImportCandidate = DeviceEvent & {
  /** 비슷한 루틴·투두가 이미 있으면 그 목록 (없으면 빈 배열). */
  similar: SimilarHit[];
};

export type ImportOutcome = {
  imported: number;
  /** 이미 가져왔던 것 (409) — 실패가 아니다. */
  skipped: number;
  failed: number;
  /** 그중 루틴으로 들어간 개수 (#952) — 화면이 "루틴 N · 투두 M"으로 알린다. */
  importedRoutines: number;
};

/**
 * 고른 회차를 **루틴 시리즈**와 **회차 투두**로 가른다 (#952).
 *
 * 서버가 아는 반복(`repeat`)이면 시리즈당 한 번만 루틴으로 보낸다 — 회차가
 * 여러 개 골렸어도 요청은 하나다. 담을 수 없는 반복과 일회성은 지금처럼
 * 회차 투두로 간다(근사하면 없는 날에 할 일이 뜬다).
 *
 * 요일·일·월은 규칙이 아니라 **회차 날짜**에서 뽑는다 —
 * `recurrenceRule.daysOfTheWeek`가 iOS 전용이라 안드로이드에서는 비어 온다.
 */
export function splitForImport(selected: ImportCandidate[]): {
  routines: {
    seriesId: string;
    title: string;
    repeat: NonNullable<DeviceEvent['repeat']>;
    days: number[];
    dayOfMonth?: number;
    month?: number;
    startsOn: string;
  }[];
  todos: ImportCandidate[];
} {
  const bySeries = new Map<string, ImportCandidate[]>();
  const todos: ImportCandidate[] = [];
  for (const e of selected) {
    if (!e.repeat) {
      todos.push(e);
      continue;
    }
    bySeries.set(e.seriesId, [...(bySeries.get(e.seriesId) ?? []), e]);
  }
  const routines = [...bySeries.values()].map((group) => {
    const dates = group.map((g) => g.date).sort();
    const first = dates[0];
    const repeat = group[0].repeat!;
    const at = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return { d: new Date(y, m - 1, d), month: m, day: d };
    };
    return {
      seriesId: group[0].seriesId,
      title: group[0].title,
      repeat,
      // 주간·격주는 고른 회차들의 요일 전부 (같은 시리즈가 여러 요일일 수 있다).
      days:
        repeat === 'weekly' || repeat === 'biweekly'
          ? [...new Set(dates.map((iso) => at(iso).d.getDay()))].sort()
          : [],
      dayOfMonth: repeat === 'monthly' || repeat === 'yearly' ? at(first).day : undefined,
      month: repeat === 'yearly' ? at(first).month : undefined,
      startsOn: first,
    };
  });
  return { routines, todos };
}

export function useCalendarImport() {
  const [calendars, setCalendars] = useState<DeviceCalendar[] | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  /** 유사 힌트가 임베딩까지 쓴 결과인지 — false면 화면이 그렇게 밝힌다. */
  const [embeddingApplied, setEmbeddingApplied] = useState(true);

  /** 권한을 얻고 캘린더 목록을 채운다. */
  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const granted = await requestCalendarAccess();
      setDenied(!granted);
      setCalendars(granted ? await listDeviceCalendars() : []);
    } catch {
      setDenied(true);
      setCalendars([]);
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * 고른 캘린더에서 창 안의 일정을 읽고 유사 힌트를 붙인다.
   * 힌트 조회가 실패해도 후보는 그대로 돌려준다 — 힌트는 거들 뿐이라
   * 그것 때문에 임포트를 막지 않는다.
   */
  const preview = useCallback(async (calendarIds: string[]) => {
    setBusy(true);
    try {
      const events = await readUpcomingEvents(calendarIds);
      if (events.length === 0) {
        setCandidates([]);
        return;
      }
      // 서버 상한이 200개다 — 창을 30일로 잡아도 넘을 수 있어 잘라 보낸다.
      const head = events.slice(0, 200);
      const hint = await fetchSimilarity(head.map((e) => ({ date: e.date, title: e.title }))).catch(
        () => null,
      );
      setEmbeddingApplied(hint?.embeddingApplied ?? true);
      setCandidates(
        events.map((e, i) => ({
          ...e,
          similar: (i < head.length && hint?.items[i]?.similar) || [],
        })),
      );
    } catch {
      setCandidates([]);
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * 고른 일정을 가져온다. 반복은 루틴 1개로, 나머지는 회차 투두로 (#952).
   * 409는 "이미 가져옴"이라 실패가 아니라 건너뛴 것으로 센다.
   */
  const importSelected = useCallback(
    async (selected: ImportCandidate[], categoryId?: number): Promise<ImportOutcome> => {
      setBusy(true);
      const out: ImportOutcome = { imported: 0, skipped: 0, failed: 0, importedRoutines: 0 };
      const { routines, todos } = splitForImport(selected);
      try {
        for (const r of routines) {
          try {
            await importCalendarRoutine({
              title: r.title,
              repeat: r.repeat,
              days: r.days,
              dayOfMonth: r.dayOfMonth,
              month: r.month,
              startsOn: r.startsOn,
              externalSource: EXTERNAL_SOURCE,
              // 루틴은 시리즈당 한 행 — 회차 키가 아니라 시리즈 id다.
              externalId: r.seriesId,
              categoryId,
            });
            out.imported += 1;
            out.importedRoutines += 1;
          } catch (err: unknown) {
            if (err instanceof ApiError && err.code === ErrorCode.ROUTINE_EXTERNAL_DUPLICATE)
              out.skipped += 1;
            else out.failed += 1;
          }
        }
        for (const e of todos) {
          try {
            await importCalendarTodo({
              title: e.title,
              dueDate: e.date,
              externalSource: EXTERNAL_SOURCE,
              externalId: e.occurrenceId,
              categoryId,
            });
            out.imported += 1;
          } catch (err: unknown) {
            if (err instanceof ApiError && err.code === ErrorCode.TODO_EXTERNAL_DUPLICATE)
              out.skipped += 1;
            else out.failed += 1;
          }
        }
        return out;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return useMemo(
    () => ({
      calendars,
      candidates,
      busy,
      denied,
      embeddingApplied,
      connect,
      preview,
      importSelected,
    }),
    [calendars, candidates, busy, denied, embeddingApplied, connect, preview, importSelected],
  );
}
