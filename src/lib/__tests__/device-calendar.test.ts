/**
 * `toDeviceRepeat`은 기기 반복 규칙을 서버가 아는 다섯 종류로 접는 **순수
 * 함수**다 (#952). 훅 테스트는 `@/lib/device-calendar`를 통째로 목으로
 * 갈아끼워 이 분기를 한 줄도 실행하지 않는다 — 여기서 직접 본다.
 *
 * 실기기 검증이 막혀 있는 동안(캘린더는 네이티브 전용, iOS 빌드 쿼터 소진)
 * 이 표가 유일한 그물이다.
 */
import * as Calendar from 'expo-calendar';

import { occurrenceKey, toDeviceRepeat } from '@/lib/device-calendar';

const rule = (o: Partial<Calendar.RecurrenceRule>): Calendar.RecurrenceRule =>
  ({ frequency: Calendar.Frequency.WEEKLY, ...o }) as Calendar.RecurrenceRule;

describe('toDeviceRepeat (#952)', () => {
  it('반복이 아니면 undefined — 일회성은 회차 투두로 간다', () => {
    expect(toDeviceRepeat(null)).toBeUndefined();
    expect(toDeviceRepeat(undefined)).toBeUndefined();
  });

  it('서버가 아는 반복은 그대로 접는다', () => {
    expect(toDeviceRepeat(rule({ frequency: Calendar.Frequency.DAILY }))).toBe('daily');
    expect(toDeviceRepeat(rule({ frequency: Calendar.Frequency.WEEKLY }))).toBe('weekly');
    expect(toDeviceRepeat(rule({ frequency: Calendar.Frequency.WEEKLY, interval: 2 }))).toBe(
      'biweekly',
    );
    expect(toDeviceRepeat(rule({ frequency: Calendar.Frequency.MONTHLY }))).toBe('monthly');
    expect(toDeviceRepeat(rule({ frequency: Calendar.Frequency.YEARLY }))).toBe('yearly');
  });

  it('interval 미지정은 1로 본다 (expo 기본값)', () => {
    expect(
      toDeviceRepeat(rule({ frequency: Calendar.Frequency.WEEKLY, interval: undefined })),
    ).toBe('weekly');
  });

  it('격일은 담을 수 없다 — 서버 DAILY에는 간격이 없다', () => {
    expect(
      toDeviceRepeat(rule({ frequency: Calendar.Frequency.DAILY, interval: 2 })),
    ).toBeUndefined();
  });

  it('3주마다는 담을 수 없다 — 서버는 매주·격주까지다', () => {
    expect(
      toDeviceRepeat(rule({ frequency: Calendar.Frequency.WEEKLY, interval: 3 })),
    ).toBeUndefined();
  });

  it('"매월 셋째 화요일"은 담을 수 없다 — 서버 월간은 날짜만 안다', () => {
    expect(
      toDeviceRepeat(
        rule({
          frequency: Calendar.Frequency.MONTHLY,
          daysOfTheWeek: [{ dayOfTheWeek: Calendar.DayOfTheWeek.Tuesday, weekNumber: 3 }],
        }),
      ),
    ).toBeUndefined();
    // 날짜 기반 월간(daysOfTheWeek 없음)은 담긴다.
    expect(toDeviceRepeat(rule({ frequency: Calendar.Frequency.MONTHLY, daysOfTheWeek: [] }))).toBe(
      'monthly',
    );
  });

  it('격년·2년마다도 담을 수 없다', () => {
    expect(
      toDeviceRepeat(rule({ frequency: Calendar.Frequency.YEARLY, interval: 2 })),
    ).toBeUndefined();
  });
});

describe('occurrenceKey', () => {
  it('시리즈와 날짜를 합쳐 회차를 고유하게 만든다', () => {
    expect(occurrenceKey('s1', '2026-08-24')).toBe('s1:2026-08-24');
    expect(occurrenceKey('s1', '2026-08-24')).not.toBe(occurrenceKey('s1', '2026-08-31'));
  });
});
