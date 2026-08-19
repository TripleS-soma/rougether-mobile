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

import { ApiError, ErrorCode, fetchSimilarity, importCalendarTodo } from '@/api';
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
};

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

  /** 고른 일정만 투두로. 409는 "이미 가져옴"이라 건너뛴 것으로 센다. */
  const importSelected = useCallback(
    async (selected: ImportCandidate[], categoryId?: number): Promise<ImportOutcome> => {
      setBusy(true);
      const out: ImportOutcome = { imported: 0, skipped: 0, failed: 0 };
      try {
        for (const e of selected) {
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
