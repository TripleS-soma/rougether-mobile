import {
  calendarProgress,
  calendarToday,
  progressLabel,
  untilCalendarMidnight,
} from '@/utils/calendar-progress';

const counts = { routineCount: 3, todoCount: 2, routineCompletedCount: 2, todoCompletedCount: 1 };
it('종류 필터에 따라 같은 월 응답에서 완료/전체를 선택한다', () => {
  expect(calendarProgress(counts, 'all')).toEqual({ total: 5, completed: 3 });
  expect(calendarProgress(counts, 'routine')).toEqual({ total: 3, completed: 2 });
  expect(calendarProgress(counts, 'todo')).toEqual({ total: 2, completed: 1 });
});
it('구버전·누락·잘못된 집계를 0으로 바꾸지 않는다', () => {
  expect(calendarProgress({ routineCount: 3, todoCount: 2 }, 'all')).toBeUndefined();
  expect(calendarProgress({ ...counts, todoCompletedCount: 3 }, 'all')).toBeUndefined();
  expect(calendarProgress({ ...counts, routineCount: -1 }, 'routine')).toBeUndefined();
  expect(calendarProgress({ ...counts, todoCount: NaN }, 'all')).toBeUndefined();
});
it('미래·목표 없는 날·미확인을 실패와 구별한다', () => {
  expect(progressLabel({ total: 5, completed: 0 }, '2026-09-10', '2026-09-09')).toBe('예정 5개');
  expect(progressLabel({ total: 0, completed: 0 }, '2026-09-08', '2026-09-09')).toBe('기록 없음');
  expect(progressLabel({ total: 0, completed: 0 }, '2026-09-10', '2026-09-09')).toBe('일정 없음');
  expect(progressLabel(undefined, '2026-09-10', '2026-09-09')).toBe('집계 확인 중');
});
it('KST 자정 및 연도 경계를 기기 시간대와 무관하게 처리한다', () => {
  const before = Date.parse('2026-12-31T14:59:59.999Z');
  expect(calendarToday(before)).toBe('2026-12-31');
  expect(untilCalendarMidnight(before)).toBe(1);
  expect(calendarToday(before + 1)).toBe('2027-01-01');
  expect(untilCalendarMidnight(before + 1)).toBe(86400000);
});
