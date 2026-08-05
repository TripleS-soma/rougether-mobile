import {
  formatDate,
  formatTime,
  localDate,
  relativeTimeLabel,
  toIsoDate,
  weekdayOf,
} from '@/utils/datetime';

describe('datetime utils', () => {
  it('formats time and date', () => {
    expect(formatTime('07:00')).toBe('오전 7:00');
    expect(formatTime('21:30')).toBe('오후 9:30');
    expect(formatDate('2026-06-19')).toBe('2026.06.19');
    expect(toIsoDate(new Date(2026, 6, 8))).toBe('2026-07-08');
  });

  it('parses "YYYY-MM-DD" as a local date (#696) — UTC 해석이면 자정 경계에서 하루 밀린다', () => {
    const d = localDate('2026-08-05');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 5]);
    expect(d.getHours()).toBe(0);
    expect(weekdayOf('2026-08-05')).toBe(3); // 수요일
    expect(weekdayOf('2026-08-09')).toBe(0); // 일요일
  });

  it('상대 시간 라벨 — 분/시간/일 단계, 7일부터는 날짜 (#508)', () => {
    const now = new Date('2026-07-28T12:00:00');
    const at = (iso: string) => relativeTimeLabel(new Date(iso), now);

    expect(at('2026-07-28T11:59:40')).toBe('방금 전');
    expect(at('2026-07-28T11:55:00')).toBe('5분 전');
    expect(at('2026-07-28T09:00:00')).toBe('3시간 전');
    expect(at('2026-07-27T11:00:00')).toBe('1일 전');
    expect(at('2026-07-22T12:00:01')).toBe('5일 전');
    // 7일 이상은 절대 날짜로.
    expect(at('2026-07-20T12:00:00')).toBe('7월 20일');
    // 서버 시계 편차로 미래가 와도 방금 전으로 뭉갠다.
    expect(at('2026-07-28T12:00:30')).toBe('방금 전');
  });
});
