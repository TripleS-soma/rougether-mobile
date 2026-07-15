import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useMyCharacters } from '@/hooks/use-my-characters';

const res = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});

const OWNED = {
  items: [
    { userCharacterId: 11, characterId: 1, code: 'cat', name: '고양이', selected: false },
    { userCharacterId: 12, characterId: 4, code: 'panda', name: '판다', selected: true },
    // Unknown code (no local sprite art) — must drop out of the picker.
    { userCharacterId: 13, characterId: 9, code: 'dragon', name: '용', selected: false },
  ],
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useMyCharacters', () => {
  it('loads owned characters, maps codes, and surfaces the worn one', async () => {
    global.fetch = jest.fn(async () => res(OWNED)) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyCharacters());
    await waitFor(() => expect(result.current.characters).toHaveLength(2));

    expect(result.current.characters.map((c) => c.id)).toEqual(['cat', 'panda']);
    expect(result.current.selectedCharacterId).toBe('panda');
  });

  it('selects optimistically and PUTs the server id', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
      return res(init?.method === 'PUT' ? { selectedCharacterId: 1 } : OWNED);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyCharacters());
    await waitFor(() => expect(result.current.characters).toHaveLength(2));

    await act(async () => {
      await result.current.select(1);
    });

    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url.endsWith('/me/characters/select')).toBe(true);
    expect(JSON.parse(put?.body ?? '{}')).toEqual({ characterId: 1 });
    expect(result.current.selectedCharacterId).toBe('cat');
  });

  it('rolls the worn character back when the PUT fails', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return { ok: false, status: 409, text: async () => '{}' };
      return res(OWNED);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyCharacters());
    await waitFor(() => expect(result.current.characters).toHaveLength(2));

    await act(async () => {
      await result.current.select(1);
    });

    await waitFor(() => expect(result.current.selectedCharacterId).toBe('panda'));
  });
});
