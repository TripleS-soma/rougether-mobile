import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessionUserId } from '@/api';
import { calendarDayOptions, calendarMonthOptions } from '@/hooks/use-calendar-data';
import { useLatestRef } from '@/hooks/use-stable-value';
import { queryKeys } from '@/lib/query-keys';
import { calendarToday, untilCalendarMidnight } from '@/utils/calendar-progress';
import { shiftIso, weekdayOf } from '@/utils/datetime';

/** 월/선택일은 기존 달력 뮤테이션과 같은 캐시를 관찰한다. */
export function useCalendarView(reloadToday: () => Promise<void>) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const [today, setToday] = useState(calendarToday);
  const todayRef = useRef(today);
  const reloadRef = useLatestRef(reloadToday);
  const [selectedDate, setSelectedDate] = useState(calendarToday);
  const [month, setMonth] = useState<string>();
  const monthQuery = useQuery({ ...calendarMonthOptions(userId, month ?? ''), enabled: !!month });
  const dayQuery = useQuery({
    ...calendarDayOptions(userId, selectedDate),
    enabled: !!month && selectedDate !== today,
  });
  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all(userId) }),
      qc.invalidateQueries({ queryKey: queryKeys.myRoom.byUser(userId) }),
    ]);
  }, [qc, userId]);
  /** 달력만 — 방 성장이 안 바뀐 변경(보상 0 완료)용 (성능 장부 N2). */
  const refreshDays = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.calendar.all(userId) });
  }, [qc, userId]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      const next = calendarToday();
      const previous = todayRef.current;
      if (next !== previous) {
        todayRef.current = next;
        setToday(next);
        setSelectedDate((date) => (date === previous ? next : date));
        void refresh();
        void reloadRef.current().catch(() => {});
      }
      timer = setTimeout(check, untilCalendarMidnight() + 50);
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [refresh, reloadRef]);
  /**
   * 그 날짜가 든 주(일~토) 7일을 미리 받는다 (2026-11-04) — 주간 보기에서 날짜를 옮길 때마다
   * 처음 보는 날은 목록 자리에 로딩이 떴다가 바뀌어 깜빡였다. 오늘은 방 데이터로 그리므로
   * 빼고, 이미 받은 날은 react-query가 건너뛴다(staleTime Infinity).
   */
  const prefetchWeek = useCallback(
    (date: string) => {
      const sunday = shiftIso(date, -weekdayOf(date));
      for (let i = 0; i < 7; i += 1) {
        const day = shiftIso(sunday, i);
        if (day === todayRef.current) continue;
        void qc.prefetchQuery(calendarDayOptions(userId, day));
      }
    },
    [qc, userId],
  );
  const { refetch: refetchMonth } = monthQuery;
  const { refetch: refetchDay } = dayQuery;
  const retryMonth = useCallback(() => {
    void refetchMonth();
  }, [refetchMonth]);
  const retryDay = useCallback(() => {
    void refetchDay();
  }, [refetchDay]);
  return {
    today,
    selectedDate,
    setSelectedDate,
    setMonth,
    monthDays: monthQuery.data?.days,
    monthTodoDates: monthQuery.data?.dates,
    monthLoading: !!month && monthQuery.isPending,
    monthError: monthQuery.isError,
    selectedDayItems: dayQuery.data?.items,
    dayError: selectedDate !== today && dayQuery.isError,
    retryMonth,
    retryDay,
    refresh,
    refreshDays,
    prefetchWeek,
  };
}
