import { isScheduledOn } from '@/components/screens/my-room/schedule';
import type { Routine } from '@/constants/routines';

describe('isScheduledOn — 건너뛴 발생분 (#189)', () => {
  const daily: Routine = { id: 'r-1', title: '스트레칭', repeat: 'daily' };

  it('skippedDates에 든 날짜만 예정에서 빠지고 다른 날은 그대로다', () => {
    const skipped = { ...daily, skippedDates: ['2026-09-13'] };
    expect(isScheduledOn(daily, '2026-09-13')).toBe(true);
    expect(isScheduledOn(skipped, '2026-09-13')).toBe(false);
    expect(isScheduledOn(skipped, '2026-09-14')).toBe(true);
  });

  it('투두는 skippedDates와 무관하게 마감일로만 본다', () => {
    const todo: Routine = { id: 't-1', title: '할 일', kind: 'todo', dueDate: '2026-09-13' };
    expect(isScheduledOn({ ...todo, skippedDates: ['2026-09-13'] }, '2026-09-13')).toBe(true);
  });
});
