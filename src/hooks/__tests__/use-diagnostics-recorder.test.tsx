import { act, renderHook } from '@testing-library/react-native';

import { clearSession } from '@/api/auth';
import { apiGet } from '@/api/client';
import { useDiagnosticsRecorder } from '@/hooks/use-diagnostics-recorder';
import { __resetDiagnosticsForTests, recentDiagnostics } from '@/lib/diagnostics-log';
import { jsonRes as res } from '@/test-utils/fetch';

const realFetch = global.fetch;
beforeEach(() => __resetDiagnosticsForTests());
afterEach(() => {
  global.fetch = realFetch;
});

describe('진단 기록 배선 (#1162)', () => {
  it('화면 이동을 남기고 세션이 지워지면 비운다', async () => {
    const { rerender } = await renderHook(
      ({ screen }: { screen: string }) => useDiagnosticsRecorder(screen),
      {
        initialProps: { screen: 'myRoom' },
      },
    );
    await rerender({ screen: 'gacha' });
    expect(recentDiagnostics().map((e) => (e.kind === 'screen' ? e.screen : e.kind))).toEqual([
      'myRoom',
      'gacha',
    ]);
    await act(async () => {
      await clearSession();
    });
    expect(recentDiagnostics()).toHaveLength(0);
  });

  it('API 요청은 경로·결과·시간만 남긴다(본문·쿼리 값 없음)', async () => {
    global.fetch = jest.fn(async () => res({ ok: true })) as unknown as typeof fetch;
    await apiGet('/routines/42?date=2026-09-16', { auth: true });
    const [event] = recentDiagnostics();
    expect(event).toMatchObject({
      kind: 'api',
      method: 'GET',
      path: '/routines/{id}',
      status: 'ok',
    });
    expect(JSON.stringify(event)).not.toContain('2026-09-16');
  });
});
