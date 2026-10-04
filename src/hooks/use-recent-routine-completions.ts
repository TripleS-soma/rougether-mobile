/**
 * 인증글에 연결할 루틴 고르기 (#1456, 서버 #430) — KST 오늘과 이전 6일의 GET /calendar에서
 * **완료한 루틴**만 모아 날짜별로 묶는다. 투두는 대상이 아니고, 건너뛴(SKIPPED) 발생분은
 * /calendar가 애초에 빼서 돌려준다(spec routine-todo/api.md 소싱 규칙).
 *
 * 날짜 캐시는 달력 탭과 같은 키(`queryKeys.calendar.day`)·같은 모양을 쓴다 — 달력에서 이미
 * 받은 날은 곧바로 보이고, 루틴 완료로 달력이 무효화되면 여기도 같이 맞춰진다. 다만 고르기는
 * 방금 완료한 루틴이 보여야 하므로 관찰할 때마다 다시 받는다(`staleTime: 0`).
 */
import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { getSessionUserId } from '@/api/auth';
import { toServerItemId } from '@/api/adapters';
import type {
  FeedCompletionGroup,
  FeedCompletionOption,
  FeedCompletionPicker,
} from '@/components/screens/feed/types';
import { FEED_ROUTINE_WINDOW_DAYS } from '@/constants/feed';
import { type CalendarDayData, calendarDayOptions } from '@/hooks/use-calendar-data';
import { queryKeys } from '@/lib/query-keys';
import { shiftIso, todayIso } from '@/utils/datetime';

/** 연결할 수 있는 날짜들 — KST 오늘부터 하루씩 거슬러 `FEED_ROUTINE_WINDOW_DAYS`일. */
export function recentCompletionDates(
  today: string,
  days: number = FEED_ROUTINE_WINDOW_DAYS,
): string[] {
  return Array.from({ length: days }, (_, i) => shiftIso(today, -i));
}

/**
 * 날짜별 /calendar → 고르기 목록. 날짜 순서는 받은 순서(최근부터)를 따르고, 완료한 루틴이
 * 없는 날은 뺀다. 같은 날 같은 루틴이 두 번 오면 한 번만.
 */
export function toCompletionGroups(
  days: readonly (CalendarDayData | undefined)[],
): FeedCompletionGroup[] {
  const groups: FeedCompletionGroup[] = [];
  for (const day of days) {
    if (!day) continue;
    const seen = new Set<number>();
    const options: FeedCompletionOption[] = [];
    for (const item of day.items) {
      if (item.kind !== 'routine' || !item.completed) continue;
      const routineId = toServerItemId(item.id);
      if (!Number.isInteger(routineId) || routineId <= 0 || seen.has(routineId)) continue;
      seen.add(routineId);
      options.push({ routineId, title: item.title, date: day.date });
    }
    if (options.length > 0) groups.push({ date: day.date, options });
  }
  return groups;
}

/** 관찰 중인 날짜들 → 목록·상태. 모듈 스코프라 결과가 같으면 메모된다. */
const combine = (results: UseQueryResult<CalendarDayData>[]) => ({
  groups: toCompletionGroups(results.map((r) => r.data)),
  loading: results.some((r) => r.isLoading),
  error: results.some((r) => r.isError),
});

/**
 * `enabled`가 거짓이면 요청하지 않는다 — 셸에 상주하므로 작성 화면에서 인증게시판을 골랐거나
 * 수정 창이 열렸을 때만 켠다. `today`는 테스트용(기본 KST 오늘).
 */
export function useRecentRoutineCompletions({
  enabled,
  today: todayOverride,
}: {
  enabled: boolean;
  today?: string;
}): FeedCompletionPicker {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const today = todayOverride ?? todayIso();
  const dates = useMemo(() => recentCompletionDates(today), [today]);

  const queries = useMemo(
    () =>
      dates.map((date) => ({
        ...calendarDayOptions(userId, date),
        staleTime: 0,
        enabled,
      })),
    [dates, userId, enabled],
  );
  const { groups, loading, error } = useQueries({ queries, combine });

  const onRetry = useCallback(() => {
    for (const date of dates) {
      void qc.refetchQueries({ queryKey: queryKeys.calendar.day(userId, date), exact: true });
    }
  }, [qc, userId, dates]);

  return useMemo(
    () => ({ groups, loading: enabled && loading, error, onRetry }),
    [groups, enabled, loading, error, onRetry],
  );
}
