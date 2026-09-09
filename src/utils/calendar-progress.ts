import type { CalendarDayCount } from '@/api/types';

export type CalendarFilter = 'all' | 'routine' | 'todo';
export type DayProgress = { total: number; completed: number };

/** 누락/구버전 응답을 0%로 보이지 않는다. 서버가 준 유효한 집계만 그린다. */
export function calendarProgress(
  day: CalendarDayCount,
  filter: CalendarFilter,
): DayProgress | undefined {
  const totals =
    filter === 'routine'
      ? [day.routineCount]
      : filter === 'todo'
        ? [day.todoCount]
        : [day.routineCount, day.todoCount];
  const done =
    filter === 'routine'
      ? [day.routineCompletedCount]
      : filter === 'todo'
        ? [day.todoCompletedCount]
        : [day.routineCompletedCount, day.todoCompletedCount];
  if (
    ![...totals, ...done].every((n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)
  )
    return undefined;
  if (done.some((n, i) => n! > totals[i]!)) return undefined;
  return {
    total: totals.reduce<number>((a, n) => a + n!, 0),
    completed: done.reduce<number>((a, n) => a + n!, 0),
  };
}

export function progressLabel(progress: DayProgress | undefined, date: string, today: string) {
  if (!progress) return '집계 확인 중';
  if (progress.total === 0) return date < today ? '기록 없음' : '일정 없음';
  if (date > today) return `예정 ${progress.total}개`;
  return `${progress.completed}개 완료, 전체 ${progress.total}개`;
}

const KST_OFFSET = 9 * 60 * 60 * 1000;
/** UTC 시각에 KST 오프셋을 적용한다. 기기 시간대에 영향받지 않는 서버 날짜. */
export function calendarToday(now = Date.now()): string {
  return new Date(now + KST_OFFSET).toISOString().slice(0, 10);
}
export function untilCalendarMidnight(now = Date.now()): number {
  return 86400000 - ((now + KST_OFFSET) % 86400000);
}
