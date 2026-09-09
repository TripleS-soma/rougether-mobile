import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessionUserId } from '@/api';
import { calendarDayOptions, calendarMonthOptions } from '@/hooks/use-calendar-data';
import { useLatestRef } from '@/hooks/use-stable-value';
import { queryKeys } from '@/lib/query-keys';
import { calendarToday, untilCalendarMidnight } from '@/utils/calendar-progress';

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
  };
}
