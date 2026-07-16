import { act, renderHook, waitFor } from '@testing-library/react-native';

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

describe('useMyRoomData — completion callback (미션 연동, #272)', () => {
  it('fires onCompleted only for a successful completion, not an un-complete', async () => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/categories')) return res({ items: [{ id: 1, name: '집카테고리' }] });
      if (url.endsWith('/routines'))
        return res({
          items: [{ id: 9, title: '아침 스트레칭', categoryId: 1, repeatType: 'DAILY' }],
        });
      if ((init?.method ?? 'GET') === 'POST' && url.includes('/routines/9/logs'))
        return res({ rewardAmount: 0 });
      if ((init?.method ?? 'GET') === 'DELETE') return res({});
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1 });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const routine = result.current.routines[0];
    const onCompleted = jest.fn();

    await act(async () => {
      await result.current.toggleCompletion(routine.id, todayIso, onCompleted);
    });
    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ title: '아침 스트레칭' }));

    onCompleted.mockClear();
    // Now completed → the same call un-completes; the callback must stay quiet.
    await act(async () => {
      await result.current.toggleCompletion(routine.id, todayIso, onCompleted);
    });
    expect(onCompleted).not.toHaveBeenCalled();
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

describe('useMyRoomData — profile save (PUT /me)', () => {
  it('seeds bio from /me and sends nickname+bio on saveProfile', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (method === 'PUT' && url.endsWith('/me')) {
        return res({ userId: 1, nickname: '새닉', bio: '새 소개' });
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터', bio: '기존 소개' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // bio seeds from GET /me.
    expect(result.current.bio).toBe('기존 소개');

    await result.current.saveProfile('새닉', '새 소개');

    const put = calls.find((c) => c.method === 'PUT' && c.url.endsWith('/me'));
    expect(JSON.parse(put?.body ?? '{}')).toEqual({ nickname: '새닉', bio: '새 소개' });
    await waitFor(() => expect(result.current.nickname).toBe('새닉'));
    expect(result.current.bio).toBe('새 소개');
  });

  it('rolls back nickname and bio when PUT /me fails', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'PUT' && url.endsWith('/me')) {
        return { ok: false, status: 500, text: async () => '{}' };
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터', bio: '기존 소개' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const ok = await result.current.saveProfile('새닉', '새 소개');

    expect(ok).toBe(false);
    expect(result.current.nickname).toBe('테스터');
    expect(result.current.bio).toBe('기존 소개');
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
