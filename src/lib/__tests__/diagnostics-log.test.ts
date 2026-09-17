import {
  __resetDiagnosticsForTests,
  clearDiagnostics,
  DIAGNOSTICS_MAX_AGE_MS,
  DIAGNOSTICS_MAX_EVENTS,
  formatDiagnostics,
  normalizeDiagnosticsPath,
  recentDiagnostics,
  recordApi,
  recordAppState,
  recordScreen,
} from '@/lib/diagnostics-log';

beforeEach(() => __resetDiagnosticsForTests());

describe('diagnostics-log (#1162)', () => {
  it('최근 N건만 보관한다(링버퍼)', () => {
    for (let i = 0; i < DIAGNOSTICS_MAX_EVENTS + 20; i += 1) recordScreen(`s${i}`, 1000 + i);
    const kept = recentDiagnostics(1000 + DIAGNOSTICS_MAX_EVENTS + 20);
    expect(kept).toHaveLength(DIAGNOSTICS_MAX_EVENTS);
    expect(kept[0]).toMatchObject({ screen: 's20' });
  });

  it('보관 시간이 지난 이벤트는 요약에서 뺀다', () => {
    recordScreen('old', 0);
    recordScreen('new', DIAGNOSTICS_MAX_AGE_MS);
    expect(
      recentDiagnostics(DIAGNOSTICS_MAX_AGE_MS + 1).map((e) => e.kind === 'screen' && e.screen),
    ).toEqual(['new']);
  });

  it('경로의 쿼리·식별자를 지운다 — 숫자 id·UUID·초대코드', () => {
    expect(normalizeDiagnosticsPath('/routines/123/logs?date=2026-09-16')).toBe(
      '/routines/{id}/logs',
    );
    expect(normalizeDiagnosticsPath('/invites/by-code/AB12CD34')).toBe('/invites/by-code/{id}');
    expect(normalizeDiagnosticsPath('/rooms/8d3f2a10-1b2c-4d5e-8f90-123456789abc')).toBe(
      '/rooms/{id}',
    );
    expect(normalizeDiagnosticsPath('/me/bug-reports')).toBe('/me/bug-reports');
  });

  it('API 기록에는 경로·상태·시간만 남고 민감정보 필드가 없다', () => {
    recordApi(
      { method: 'POST', path: '/auth/refresh?token=secret', status: 401, durationMs: 12.6 },
      5,
    );
    const [event] = recentDiagnostics(5);
    expect(event).toEqual({
      kind: 'api',
      at: 5,
      method: 'POST',
      path: '/auth/refresh',
      status: 401,
      durationMs: 13,
      requestId: undefined,
    });
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('세션 정리 시 비운다', () => {
    recordAppState('background', 1);
    clearDiagnostics();
    expect(recentDiagnostics(1)).toHaveLength(0);
  });

  it('요약은 예산 안에서 최근 줄을 우선 남기고 헤더·Sentry ID는 항상 싣는다', () => {
    recordScreen('myRoom', 1000);
    recordApi({ method: 'GET', path: '/routines', status: 'ok', durationMs: 80 }, 2000);
    recordAppState('background', 3000);
    const full = formatDiagnostics({ budget: 500, header: 'H', sentryEventId: 'abc', now: 4000 });
    expect(full.split('\n')).toEqual([
      'H',
      'sentry abc',
      '-3s screen myRoom',
      '-2s GET /routines ok 80ms',
      '-1s app background',
    ]);
    const tight = formatDiagnostics({
      budget: 'H\nsentry abc'.length + 20,
      header: 'H',
      sentryEventId: 'abc',
      now: 4000,
    });
    expect(tight.split('\n')).toEqual(['H', 'sentry abc', '-1s app background']);
    expect(formatDiagnostics({ budget: 0, header: 'H', now: 4000 })).toBe('');
  });
});
