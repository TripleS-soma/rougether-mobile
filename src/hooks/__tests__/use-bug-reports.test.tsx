import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useBugReports } from '@/hooks/use-bug-reports';

const res = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(body),
});

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useBugReports', () => {
  it('loads my reports and auto-attaches appVersion/deviceInfo on submit', async () => {
    const calls: { url: string; method?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method });
      if (init?.method === 'POST') return res({ bugReportId: 9 }, 201);
      return res({
        items: [{ bugReportId: 1, title: '버그', status: 'RECEIVED', createdAt: '2026-07-20T09:00:00Z' }], // prettier-ignore
      });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useBugReports());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toMatchObject({ id: 1, status: 'RECEIVED' });

    let ok = false;
    await act(async () => {
      ok = await result.current.submit({ title: '제목', content: '내용', images: [] });
    });
    expect(ok).toBe(true);
    const post = calls.find((c) => c.method === 'POST');
    // 재현 정보를 자동 첨부한다 (#496) — 값은 환경마다 달라 파라미터 존재만 확인.
    expect(post?.url).toContain('deviceInfo=');
    // 제출 성공 후 목록을 다시 불러온다.
    await waitFor(() => expect(calls.filter((c) => c.method !== 'POST').length).toBeGreaterThan(1));
  });

  it('load 실패는 조용히(기존 목록 유지), submit 실패는 false', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return res({ code: 'X' }, 500);
      return res({ code: 'X' }, 500);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useBugReports());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.entries).toEqual([]);

    let ok = true;
    await act(async () => {
      ok = await result.current.submit({ title: 't', content: 'c', images: [] });
    });
    expect(ok).toBe(false);
  });
});
