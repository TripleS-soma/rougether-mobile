/**
 * 달력 탭 서버 상태 (#1027 — useMyRoomData에서 분리한 첫 조각). 날짜별 목록
 * (GET /calendar)과 달별 점(GET /calendar/month)을 react-query 캐시로 들고,
 * 달력에서의 완료 토글을 뮤테이션으로 돌린다.
 *
 * 종전에는 `calendarDays`·`todoDatesByMonth` 두 useState가 캐시였고, 루틴을
 * 고칠 때마다 `refreshCachedCalendarDays`가 방문한 날짜를 하나씩 다시 불렀다.
 * 이제 그 자리는 `invalidateCalendar()` 한 번이다 — `queryKeys.calendar.all`
 * 접두로 무효화하면 **관찰 중인**(= 사용자가 골랐던) 날짜·달만 react-query가
 * 재조회한다. 요청 수는 같고, 콜백 참조가 캐시 내용에 묶이지 않는다 (#539).
 *
 * 조회는 종전과 똑같이 **지연**이다: 날짜는 사용자가 고를 때(`loadCalendarDay`),
 * 달은 보이는 달이 바뀔 때(`loadCalendarMonth`) 처음 요청되고, 그때마다 항상
 * 다시 받는다(루틴 수정이 미래 날짜를 바꾸므로 — 이전 데이터는 응답이 올 때까지
 * 남는다). 골랐던 날짜·달의 목록을 `useQueries`로 관찰해 캐시를 화면용 모양으로
 * 합친다 — `combine`은 모듈 스코프에 두어 결과 참조가 내용이 같으면 고정된다.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  queryOptions,
  useMutation,
  useQueries,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  completeRoutine,
  completeTodo,
  fetchCalendarDay,
  fetchCalendarMonth,
  getSessionUserId,
  uncompleteRoutine,
  uncompleteTodo,
} from '@/api';
import { toCalendarItems, toServerItemId } from '@/api/adapters';
import type { CalendarDayItem } from '@/components/screens/my-room-screen';
import { useToast } from '@/components/ui/toast';
import type { Routine } from '@/constants/routines';
import { queryKeys } from '@/lib/query-keys';

type UserId = ReturnType<typeof getSessionUserId>;

// 관찰자는 스스로 다시 받지 않는다(`staleTime: Infinity`) — 요청은 고를 때의
// `fetchQuery(staleTime: 0)`와 무효화로만 나간다. 종전과 같은 "필요할 때만"이고,
// 마운트·포커스 재조회로 요청이 늘거나 첫 조회가 두 번 나가는 일이 없다.
/** 날짜 캐시 — 키의 날짜를 데이터에도 실어 `combine`이 키 없이 합칠 수 있게. */
type CalendarDayData = { date: string; items: CalendarDayItem[] };
/**
 * 달 캐시 (#838, 서버 #295) — 그 달에 **투두가 있는 날**의 집합. 루틴은 세지
 * 않는다: 대부분의 날에 반복되므로 점을 찍으면 거의 모든 날에 찍혀 아무것도
 * 구분하지 못한다. 서버는 routineCount도 주지만 버린다.
 */
type CalendarMonthData = { yearMonth: string; dates: string[] };

const dayOptions = (userId: UserId, date: string) =>
  queryOptions({
    queryKey: queryKeys.calendar.day(userId, date),
    queryFn: async (): Promise<CalendarDayData> => ({
      date,
      items: toCalendarItems(await fetchCalendarDay(date)),
    }),
    staleTime: Infinity,
  });

const monthOptions = (userId: UserId, yearMonth: string) =>
  queryOptions({
    queryKey: queryKeys.calendar.month(userId, yearMonth),
    queryFn: async (): Promise<CalendarMonthData> => {
      const res = await fetchCalendarMonth(yearMonth);
      return {
        yearMonth,
        dates: (res.days ?? []).flatMap((d) => ((d.todoCount ?? 0) > 0 && d.date ? [d.date] : [])),
      };
    },
    staleTime: Infinity,
  });

/** 관찰 중인 날짜들의 캐시 → 화면이 읽는 `calendarDays` 모양. */
const combineDays = (results: UseQueryResult<CalendarDayData>[]) => {
  const days: Record<string, CalendarDayItem[]> = {};
  for (const r of results) if (r.data) days[r.data.date] = r.data.items;
  return days;
};

/** 방문한 달의 점 날짜를 한 목록으로. */
const combineMonths = (results: UseQueryResult<CalendarMonthData>[]) =>
  results.flatMap((r) => r.data?.dates ?? []);

const pushUnique = (prev: string[], value: string) =>
  prev.includes(value) ? prev : [...prev, value];

type ToggleVars = { item: CalendarDayItem; date: string };

export function useCalendarData({
  routines,
  refreshWallet,
}: {
  /** 앱이 지금 들고 있는 루틴·투두 — 투두의 dueDate가 달력 점에 즉시 반영된다 (#1133). */
  routines: Routine[];
  /** 완료 토글 뒤 헤더 코인을 서버값으로 — 부모(useMyRoomData)의 지갑 리페치. */
  refreshWallet: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  // 키는 userId로 메모 — 매 렌더 새 배열이면 콜백 참조가 흔들린다 (#539).
  const userId = getSessionUserId();
  const allKey = useMemo(() => queryKeys.calendar.all(userId), [userId]);

  // 사용자가 골랐던 날짜·달 — 이 목록만큼 쿼리를 관찰한다(= 무효화 시 재조회 대상).
  const [visitedDates, setVisitedDates] = useState<string[]>([]);
  const [visitedMonths, setVisitedMonths] = useState<string[]>([]);

  const dayQueries = useMemo(
    () => visitedDates.map((date) => dayOptions(userId, date)),
    [userId, visitedDates],
  );
  const calendarDays = useQueries({ queries: dayQueries, combine: combineDays });

  const monthQueries = useMemo(
    () => visitedMonths.map((ym) => monthOptions(userId, ym)),
    [userId, visitedMonths],
  );
  const monthTodoDates = useQueries({ queries: monthQueries, combine: combineMonths });

  /**
   * Load a date's 달력 list from GET /calendar. Always refetches (routine edits
   * change future dates); the previous data stays visible until it lands.
   * `staleTime: 0`이라 캐시가 있어도 다시 받고, 관찰자가 막 붙어 같은 요청이
   * 나가는 중이면 그 응답을 같이 기다린다(중복 요청 없음).
   */
  const loadCalendarDay = useCallback(
    async (date: string) => {
      setVisitedDates((prev) => pushUnique(prev, date));
      try {
        await qc.fetchQuery({ ...dayOptions(userId, date), staleTime: 0 });
      } catch {
        toast('달력 기록을 불러오지 못했어요', 'error');
      }
    },
    [qc, userId, toast],
  );

  const loadCalendarMonth = useCallback(
    async (yearMonth: string) => {
      setVisitedMonths((prev) => pushUnique(prev, yearMonth));
      try {
        await qc.fetchQuery({ ...monthOptions(userId, yearMonth), staleTime: 0 });
      } catch {
        // 점은 보조 정보다 — 실패해도 달력 자체는 쓸 수 있으니 조용히 넘어간다.
      }
    },
    [qc, userId],
  );

  // 추가 요청이 서버에 가 있는 동안의 날짜 (#1133) — 응답을 기다리지 않고 점을 찍는다.
  const [pendingTodoDates, setPendingTodoDates] = useState<string[]>([]);
  const markPending = useCallback(
    (date: string) => setPendingTodoDates((prev) => [...prev, date]),
    [],
  );
  const unmarkPending = useCallback(
    (date: string) =>
      setPendingTodoDates((prev) => {
        const i = prev.indexOf(date);
        return i < 0 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
      }),
    [],
  );
  /**
   * 방문한 달을 합친 표시용 집합. 여기에 **지금 앱이 들고 있는 투두의 날짜**와
   * 요청 중인 날짜를 합친다 (#1133): 추가하자마자 점이 찍히고, 삭제하면 서버 월
   * 목록을 다시 받기 전에도 빠진다(그 날의 마지막 투두를 지운 경우는 월 캐시에서도
   * 걷어낸다 — `unmarkTodoDate`).
   */
  const markedTodoDates = useMemo(
    () =>
      new Set([
        ...monthTodoDates,
        ...pendingTodoDates,
        ...routines.flatMap((r) => (r.kind === 'todo' && r.dueDate ? [r.dueDate] : [])),
      ]),
    [monthTodoDates, pendingTodoDates, routines],
  );
  /** 그 날의 마지막 투두를 지웠을 때 — 서버 월 목록이 다시 오기 전까지 점을 걷는다. */
  const unmarkTodoDate = useCallback(
    (date: string) => {
      qc.setQueryData<CalendarMonthData>(
        queryKeys.calendar.month(userId, date.slice(0, 7)),
        (prev) =>
          prev?.dates.includes(date)
            ? { ...prev, dates: prev.dates.filter((d) => d !== date) }
            : prev,
      );
    },
    [qc, userId],
  );

  /**
   * 루틴·투두 변경이 달력 캐시에도 반영되도록 (#323) — 방문한 날짜·달을 전부
   * 무효화한다. 종전 `refreshCachedCalendarDays`의 자리이며, 재조회는 관찰 중인
   * 쿼리에만 나간다.
   */
  const invalidateCalendar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: allKey });
  }, [qc, allKey]);

  /**
   * 달력 (non-today) completion toggle. Todos flip status (date-agnostic);
   * routines log against the picked date — the server accepts past dates
   * (reward 0 for non-today, #183) and rejects future ones (screen blocks
   * those first). 응답이 오면 캐시의 그 항목을 먼저 뒤집고(재조회를 기다리지
   * 않고 체크가 따라온다), 달력 전체를 무효화해 목록이 서버를 비추게 한다.
   */
  const { mutateAsync: toggleAsync } = useMutation({
    mutationFn: async ({ item, date }: ToggleVars): Promise<number | undefined> => {
      const numId = toServerItemId(item.id);
      if (item.kind === 'todo') {
        if (item.completed) {
          await uncompleteTodo(numId);
          return undefined;
        }
        return (await completeTodo(numId)).rewardAmount;
      }
      if (item.completed) {
        await uncompleteRoutine(numId, date);
        return undefined;
      }
      return (await completeRoutine(numId, date)).rewardAmount;
    },
    onSuccess: async (rewardAmount, { item, date }) => {
      if (rewardAmount) toast(`+${rewardAmount} 코인 획득!`, 'success');
      qc.setQueryData<CalendarDayData>(queryKeys.calendar.day(userId, date), (prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === item.id && i.kind === item.kind ? { ...i, completed: !item.completed } : i,
              ),
            }
          : prev,
      );
      await Promise.all([qc.invalidateQueries({ queryKey: allKey }), refreshWallet()]);
    },
    onError: () => {
      toast('완료 처리에 실패했어요', 'error');
    },
    // 완료 토글은 멱등이 아니다 — 서버에서는 성공했는데 응답만 잃은 요청을 자동으로
    // 다시 보내면 완료를 도로 뒤집는다(`use-gacha`의 뽑기와 같은 이유).
    retry: false,
  });
  // 실패는 onError가 토스트로 알렸다 — 호출부(`void toggleCalendarItem(...)`)로 던지지 않는다.
  const toggleCalendarItem = useCallback(
    async (item: CalendarDayItem, date: string) => {
      try {
        await toggleAsync({ item, date });
      } catch {
        // handled in onError
      }
    },
    [toggleAsync],
  );

  return useMemo(
    () => ({
      calendarDays,
      loadCalendarDay,
      loadCalendarMonth,
      markedTodoDates,
      markPending,
      unmarkPending,
      unmarkTodoDate,
      invalidateCalendar,
      toggleCalendarItem,
    }),
    [
      calendarDays,
      loadCalendarDay,
      loadCalendarMonth,
      markedTodoDates,
      markPending,
      unmarkPending,
      unmarkTodoDate,
      invalidateCalendar,
      toggleCalendarItem,
    ],
  );
}
