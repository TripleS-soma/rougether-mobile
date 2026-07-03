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
