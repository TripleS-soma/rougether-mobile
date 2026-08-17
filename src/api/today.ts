/** Today dashboard + calendar endpoints — routines/todos grouped by category. */
import { apiGet } from './client';
import { buildQuery } from './http';
import type { CalendarDayResponse, CalendarMonthResponse, TodayResponse } from './types';

/** GET /today. */
export function fetchToday() {
  return apiGet<TodayResponse>('/today');
}

/** GET /calendar?date=YYYY-MM-DD — that day's routines/todos + completion. */
export function fetchCalendarDay(date: string) {
  return apiGet<CalendarDayResponse>(`/calendar${buildQuery({ date })}`);
}

/**
 * GET /calendar/month?yearMonth=YYYY-MM — 그 달 날짜별 루틴·투두 **개수만**
 * (목록·완료 여부 없음). 달력 월 뷰의 점 표시용 (#838, 서버 #295).
 *
 * 대상이 없는 날도 0으로 포함해 1일~말일이 전부 온다. 소싱 규칙은
 * `/calendar`와 동일하고, 투두는 `dueDate`가 그날인 것만 센다.
 */
export function fetchCalendarMonth(yearMonth: string) {
  return apiGet<CalendarMonthResponse>(`/calendar/month${buildQuery({ yearMonth })}`);
}
