import {
  buildWidgetSummary,
  loadWidgetRoomImage,
  loadWidgetSummary,
  loadWidgetTheme,
  saveWidgetRoomImage,
  saveWidgetSummary,
  saveWidgetTheme,
} from '@/widgets/widget-data';
import type { Routine } from '@/constants/routines';

const r = (id: string, title: string): Routine => ({ id, title, kind: 'routine' });

describe('widget-data (#604)', () => {
  it('오늘 요약 — 완료 수·남은 제목 앞 3개를 계산한다', () => {
    const scheduled = [
      r('1', '기상'),
      r('2', '영양제'),
      r('3', '산책'),
      r('4', '독서'),
      r('5', '회고'),
    ];
    const completions = { '1': ['2026-07-30'], '9': ['2026-07-30'] };
    expect(buildWidgetSummary(scheduled, completions, 7, '2026-07-30')).toEqual({
      done: 1,
      total: 5,
      streak: 7,
      remaining: ['영양제', '산책', '독서'],
    });
    // 다른 날짜의 완료 기록은 오늘 완료로 치지 않는다.
    expect(buildWidgetSummary(scheduled, { '1': ['2026-07-29'] }, 0, '2026-07-30').done).toBe(0);
    expect(buildWidgetSummary([], {}, 3, '2026-07-30')).toEqual({
      done: 0,
      total: 0,
      streak: 3,
      remaining: [],
    });
  });

  it('요약·방 이미지 저장/로드 왕복', async () => {
    const summary = { done: 2, total: 4, streak: 1, remaining: ['산책'] };
    await saveWidgetSummary(summary);
    expect(await loadWidgetSummary()).toEqual(summary);

    await saveWidgetRoomImage('data:image/png;base64,QUJD');
    expect(await loadWidgetRoomImage()).toBe('data:image/png;base64,QUJD');
  });

  // 위젯 다크모드 (#746) — 앱의 테마 모드가 적용된 실효 스킴을 위젯이 읽는다.
  // 저장값이 없으면 null이라 위젯이 시스템 스킴으로 폴백한다.
  it('실효 테마 저장/로드 왕복 — 미저장은 null(시스템 폴백)', async () => {
    expect(await loadWidgetTheme()).toBeNull();

    await saveWidgetTheme(true);
    expect(await loadWidgetTheme()).toBe('dark');

    await saveWidgetTheme(false);
    expect(await loadWidgetTheme()).toBe('light');
  });
});
