import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useWeeklyReport } from '@/hooks/use-weekly-report';

const res = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

/** 목록은 일부러 오래된 주를 먼저 준다 — 훅이 서버 정렬을 믿으면 안 된다. */
function mockServer() {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: string) => {
    calls.push(url);
    if (/\/reports\/weekly\/\d+$/.test(url)) {
      return res({ reportId: 9, status: 'GENERATED', highlights: ['잘했어요'] });
    }
    if (url.includes('/reports/weekly')) {
      return res({
        items: [
          { reportId: 3, weekStartDate: '2026-08-02', completionRate: 0.1 },
          { reportId: 9, weekStartDate: '2026-08-09', completionRate: 0.36 },
        ],
      });
    }
    return res({});
  }) as unknown as typeof global.fetch;
  return calls;
}

describe('useWeeklyReport', () => {
  it('목록 순서와 무관하게 가장 최근 주를 고른다', async () => {
    mockServer();
    const { result } = await renderHook(() => useWeeklyReport());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.latest?.reportId).toBe(9);
  });

  it('상세는 마운트가 아니라 loadDetail을 부를 때만 받아온다', async () => {
    const calls = mockServer();
    const { result } = await renderHook(() => useWeeklyReport());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    // 카드에 필요한 건 요약뿐 — 아직 상세를 부르면 안 된다.
    expect(calls.some((u) => /\/reports\/weekly\/9$/.test(u))).toBe(false);

    await act(async () => {
      await result.current.loadDetail();
    });
    expect(result.current.detail?.reportId).toBe(9);
    expect(calls.filter((u) => /\/reports\/weekly\/9$/.test(u))).toHaveLength(1);
  });

  it('같은 회고를 다시 열면 재요청하지 않는다', async () => {
    const calls = mockServer();
    const { result } = await renderHook(() => useWeeklyReport());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.loadDetail();
    });
    await act(async () => {
      await result.current.loadDetail();
    });
    expect(calls.filter((u) => /\/reports\/weekly\/9$/.test(u))).toHaveLength(1);
  });

  /** 회고는 부가 정보다 — 목록이 깨져도 달력 탭 자체는 살아야 한다. */
  it('목록 요청이 실패해도 빈 상태로 끝내고 던지지 않는다', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof global.fetch;
    const { result } = await renderHook(() => useWeeklyReport());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.latest).toBeNull();
  });

  it('enabled=false면 아무 요청도 하지 않는다', async () => {
    const calls = mockServer();
    const { result } = await renderHook(() => useWeeklyReport(false));
    expect(calls).toHaveLength(0);
    expect(result.current.loaded).toBe(false);
  });
});
