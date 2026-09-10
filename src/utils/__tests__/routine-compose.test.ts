import { firstRoutineDate, routineComposeError } from '@/utils/routine-compose';
import type { NewRoutine } from '@/constants/routines';
const base: NewRoutine = {
  title: '독서',
  category: '',
  startDate: '2026-09-10',
  repeat: 'daily',
  days: [],
  alarmEnabled: false,
  time: '07:00',
};
it.each([
  [{ repeat: 'daily' }, '2026-09-10'],
  [{ repeat: 'weekly', days: [5] }, '2026-09-11'],
  [{ repeat: 'biweekly', days: [1] }, '2026-09-21'],
  [{ repeat: 'monthly', dayOfMonth: 31 }, '2026-10-31'],
  [{ repeat: 'yearly', month: 2, dayOfMonth: 29 }, '2028-02-29'],
  [{ repeat: 'yearly', month: 2, dayOfMonth: 29, startDate: '2097-01-01' }, '2104-02-29'],
] as [Partial<NewRoutine>, string][])(
  '첫 실행일은 서버와 같은 반복 규칙을 따른다: %j',
  (fields, expected) => {
    expect(firstRoutineDate({ ...base, ...fields })).toBe(expected);
  },
);
it('종료일 안에 실행일이 없거나 실존하지 않는 연간 날짜는 거부한다', () => {
  expect(
    firstRoutineDate({ ...base, repeat: 'weekly', days: [5], endDate: base.startDate }),
  ).toBeNull();
  expect(
    routineComposeError({ ...base, repeat: 'yearly', month: 2, dayOfMonth: 30 }, base.startDate),
  ).toContain('반복되는 날짜');
});
