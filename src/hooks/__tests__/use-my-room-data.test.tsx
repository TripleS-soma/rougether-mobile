import { renderHook, waitFor } from '@testing-library/react-native';

import { useMyRoomData } from '@/hooks/use-my-room-data';

// Server state: no categories, two routines with categoryId null (legacy data).
// The hook must adopt them into a freshly created 기타 category — uncategorized
// routines must not exist.
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

describe('useMyRoomData — completion routing on id collision', () => {
  it('completes the todo (not the same-numbered routine) when server ids collide', async () => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const calls: { url: string; method: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      if (url.includes('/categories')) {
        return res({ items: [{ id: 1, name: '건강', colorHex: '#F00' }] });
      }
      if (url.endsWith('/routines')) {
        return res({
          items: [{ id: 5, title: '같은번호 루틴', categoryId: 1, repeatType: 'DAILY' }],
        });
      }
      if (url.endsWith('/todos')) {
        return res({
          items: [
            { id: 5, title: '같은번호 투두', categoryId: 1, dueDate: todayIso, status: 'PENDING' },
          ],
        });
      }
      if (method === 'POST' && url.endsWith('/todos/5/complete')) {
        return res({ id: 5, status: 'COMPLETED', rewardAmount: 10 });
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const todo = result.current.routines.find((r) => r.kind === 'todo')!;
    await result.current.toggleCompletion(todo.id, todayIso);

    // The todo endpoint is hit — never the routine-log endpoint for id 5.
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/todos/5/complete'))).toBe(
      true,
    );
    expect(calls.some((c) => c.url.includes('/routines/5/logs'))).toBe(false);
  });
});

describe('useMyRoomData — 달력 past-date routine completion (#183)', () => {
  it('logs a past routine against the picked date and refetches the day', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (method === 'POST' && url.endsWith('/routines/7/logs')) {
        return res({ routineId: 7, routineDate: '2026-07-10', rewardAmount: 0 });
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터' });
      if (url.includes('/calendar')) return res({ categories: [], summary: {} });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.toggleCalendarItem(
      { id: '7', kind: 'routine', title: '지난 루틴', completed: false, category: '' },
      '2026-07-10',
    );

    // The dated routine-log endpoint is hit with the picked (past) date…
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/routines/7/logs'));
    expect(JSON.parse(post?.body ?? '{}').routineDate).toBe('2026-07-10');
    // …and the day is refetched so the list mirrors the server.
    expect(calls.some((c) => c.url.includes('/calendar') && c.url.includes('2026-07-10'))).toBe(
      true,
    );
  });

  it('deletes a past routine log on uncheck', async () => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터' });
      if (url.includes('/calendar')) return res({ categories: [], summary: {} });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.toggleCalendarItem(
      { id: '7', kind: 'routine', title: '지난 루틴', completed: true, category: '' },
      '2026-07-10',
    );

    expect(
      calls.some(
        (c) =>
          c.method === 'DELETE' &&
          c.url.includes('/routines/7/logs') &&
          c.url.includes('2026-07-10'),
      ),
    ).toBe(true);
  });
});

describe('useMyRoomData — uncategorized adoption', () => {
  it('creates a 기타 category and reassigns orphan routines on load', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });

      if (method === 'POST' && url.endsWith('/categories')) {
        return res({ id: 9, name: '기타', colorHex: '#B5A89C', iconKey: '✨' });
      }
      if (method === 'PUT' && /\/routines\/\d+$/.test(url)) {
        return res({ id: 2, title: '아침 기상', categoryId: 9 });
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터' });
      if (url.endsWith('/routines')) {
        return res({
          items: [
            { id: 2, title: '아침 기상', categoryId: null, repeatType: 'DAILY' },
            { id: 3, title: '독서 30분', categoryId: null, repeatType: 'DAILY' },
          ],
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // A real 기타 category was created server-side…
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/categories'))).toBe(true);
    // …and both orphans were reassigned to it.
    const puts = calls.filter((c) => c.method === 'PUT' && /\/routines\/\d+$/.test(c.url));
    expect(puts).toHaveLength(2);
    expect(JSON.parse(puts[0].body ?? '{}').categoryId).toBe(9);

    expect(result.current.categories.map((c) => c.label)).toContain('기타');
    expect(result.current.routines.every((r) => r.category === '9')).toBe(true);
  });
});
