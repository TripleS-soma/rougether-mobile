/** Today dashboard + calendar endpoints — routines/todos grouped by category. */
import { apiGet } from './client';
import { buildQuery } from './http';
import type { CalendarDayResponse, TodayResponse } from './types';

/** GET /today. */
export function fetchToday() {
  return apiGet<TodayResponse>('/today');
}

/** GET /calendar?date=YYYY-MM-DD — that day's routines/todos + completion. */
export function fetchCalendarDay(date: string) {
  return apiGet<CalendarDayResponse>(`/calendar${buildQuery({ date })}`);
}
