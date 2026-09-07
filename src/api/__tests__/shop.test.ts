import { API_BASE } from '@/api/config';
import { fetchGachas } from '@/api/shop';
import type { GachaResponse } from '@/api/types';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('fetchGachas', () => {
  it('requests the category catalog explicitly and unwraps the server machines', async () => {
    const machines: GachaResponse[] = [
      { gachaId: 101, code: 'wallpaper_gacha', category: 'WALLPAPER' },
      { gachaId: 102, code: 'floor_gacha', category: 'FLOOR' },
      { gachaId: 103, code: 'furniture_gacha', category: 'FURNITURE' },
    ];
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: machines }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchGachas()).resolves.toEqual(machines);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/gacha?catalog=category`,
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
  });
});
