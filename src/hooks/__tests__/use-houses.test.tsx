import { renderHook, waitFor } from '@testing-library/react-native';

import { useHouses } from '@/hooks/use-houses';

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

describe('useHouses — 집 탐색 filter', () => {
  it('hides houses the user already belongs to from the browse list', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/me/houses')) return res({ items: [{ houseId: 1, name: '내집' }] });
      if (url.includes('/houses/1/members')) return res({ items: [] });
      if (url.includes('/houses/1/missions')) return res({ items: [] });
      if (url.includes('/houses/1')) return res({ houseId: 1, name: '내집', myRole: 'OWNER' });
      if (url.endsWith('/me')) return res({ userId: 5, nickname: '나' });
      if (url.includes('/houses?')) {
        return res({
          items: [
            { houseId: 1, name: '내집', currentMemberCount: 1, maxMembers: 4 },
            { houseId: 2, name: '남의집', currentMemberCount: 2, maxMembers: 4 },
          ],
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // My own house (id 1) is excluded; only the joinable one remains.
    expect(result.current.searchHouses.map((h) => h.name)).toEqual(['남의집']);
    expect(result.current.houses.map((h) => h.title)).toEqual(['내집']);
  });
});
