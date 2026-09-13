import { holidayName } from '@/utils/holidays';

describe('holidayName (#1292)', () => {
  it('공휴일이면 이름을 돌려준다 — 음력 명절·대체공휴일 포함', () => {
    expect(holidayName('2026-09-25')).toBe('추석');
    expect(holidayName('2026-09-24')).toBe('추석 전날');
    expect(holidayName('2026-08-17')).toBe('대체공휴일(광복절)');
  });

  it('하루에 공휴일이 둘이면 쉼표로 잇는다', () => {
    expect(holidayName('2025-05-05')).toBe('어린이날, 부처님 오신 날');
  });

  it('평일과 표에 없는 해는 null', () => {
    expect(holidayName('2026-09-11')).toBeNull();
    expect(holidayName('2028-01-01')).toBeNull();
  });
});
