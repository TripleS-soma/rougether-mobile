import { daysSince, resolveWidgetMood } from '@/widgets/widget-mood';
import type { WidgetSummary } from '@/widgets/widget-data';

const TODAY = '2026-09-08';
const noon = new Date(2026, 8, 8, 12, 0, 0);
const evening = new Date(2026, 8, 8, 19, 30, 0);
const base = (over: Partial<WidgetSummary> = {}): WidgetSummary => ({
  done: 1,
  total: 3,
  streak: 2,
  remaining: ['물 마시기', '독서'],
  date: TODAY,
  ...over,
});
const hoursAgo = (h: number, from: Date) => new Date(from.getTime() - h * 3600_000).toISOString();

// 위젯 표정 (#1122) — 앱이 남긴 요약·접속 시각과 지금 시각만으로 정한다.
describe('resolveWidgetMood', () => {
  it('낮에 남은 루틴이 있으면 평소 얼굴, 문구 없음', () => {
    expect(
      resolveWidgetMood({
        summary: base(),
        todayIso: TODAY,
        now: noon,
        lastActiveAt: hoursAgo(1, noon),
      }),
    ).toEqual({ face: 'neutral' });
  });

  it('저녁(18시 이후)인데 남았으면 걱정 + 남은 개수', () => {
    const mood = resolveWidgetMood({
      summary: base(),
      todayIso: TODAY,
      now: evening,
      lastActiveAt: hoursAgo(3, evening),
    });
    expect(mood.face).toBe('worried');
    expect(mood.message).toBe('아직 2개 남았어요');
  });

  it('오늘 다 했으면 기쁨, 7일 스트릭이면 왕관', () => {
    const done = base({ done: 3, remaining: [] });
    expect(
      resolveWidgetMood({
        summary: done,
        todayIso: TODAY,
        now: evening,
        lastActiveAt: hoursAgo(1, evening),
      }).face,
    ).toBe('happy');
    const crown = resolveWidgetMood({
      summary: { ...done, streak: 7 },
      todayIso: TODAY,
      now: noon,
      lastActiveAt: hoursAgo(1, noon),
    });
    expect(crown.face).toBe('crown');
    expect(crown.message).toContain('7일 연속');
  });

  it('어제 요약(date 불일치)으로는 "다 했다"고 하지 않는다 — 자정 넘긴 뒤 평소 얼굴', () => {
    const stale = base({ done: 3, remaining: [], date: '2026-09-07' });
    expect(
      resolveWidgetMood({
        summary: stale,
        todayIso: TODAY,
        now: noon,
        lastActiveAt: hoursAgo(20, noon),
      }).face,
    ).toBe('neutral');
  });

  it('date 없는 구버전 요약은 오늘 것으로 본다(호환)', () => {
    const legacy = base({ done: 3, remaining: [], date: undefined });
    expect(
      resolveWidgetMood({
        summary: legacy,
        todayIso: TODAY,
        now: noon,
        lastActiveAt: hoursAgo(1, noon),
      }).face,
    ).toBe('happy');
  });

  it('미접속 2일+ 슬픔, 5일+ 울음 — 오늘 다 했어도 미접속이 우선', () => {
    const done = base({ done: 3, remaining: [] });
    const sad = resolveWidgetMood({
      summary: done,
      todayIso: TODAY,
      now: noon,
      lastActiveAt: hoursAgo(49, noon),
    });
    expect(sad.face).toBe('sad');
    expect(sad.message).toContain('2일째');
    const crying = resolveWidgetMood({
      summary: done,
      todayIso: TODAY,
      now: noon,
      lastActiveAt: hoursAgo(24 * 5 + 1, noon),
    });
    expect(crying.face).toBe('crying');
    expect(crying.message).toContain('5일');
  });

  it('접속 기록이 없거나 깨졌으면 미접속 0일로 — 구버전 설치본이 갑자기 울지 않게', () => {
    expect(daysSince(null, noon)).toBe(0);
    expect(daysSince('not-a-date', noon)).toBe(0);
    expect(daysSince(hoursAgo(47, noon), noon)).toBe(1);
  });
});
