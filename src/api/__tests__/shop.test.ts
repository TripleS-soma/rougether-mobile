import { API_BASE } from '@/api/config';
import { fetchGachas } from '@/api/shop';
import type { GachaResponse } from '@/api/types';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

describe('fetchGachas', () => {
  const machines: GachaResponse[] = [
    { gachaId: 101, code: 'wallpaper_gacha', category: 'WALLPAPER' },
    { gachaId: 102, code: 'floor_gacha', category: 'FLOOR' },
    { gachaId: 103, code: 'furniture_gacha', category: 'FURNITURE' },
  ];
  // 기존 목록에는 테마 상자·악세사리 상자도 섞여 있다 — 캐릭터와 정확한 크리스마스 코드만 골라야 한다.
  const legacy: GachaResponse[] = [
    { gachaId: 7, code: 'bakery_morning' },
    { gachaId: 8, code: 'character_gacha' },
    { gachaId: 9, code: 'character_accessories_accessories' },
    { gachaId: 812, code: 'christmas_2026', costAmount: 47 },
    { gachaId: 813, code: 'christmas_2026_old' },
    { gachaId: 814, code: 'christmas_2026', active: false },
  ];
  const respond = (items: GachaResponse[]) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ items }),
  });

  it('requests the category catalog and adds only the character and exact Christmas machines from the legacy list', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      respond(url.endsWith('?catalog=category') ? machines : legacy),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchGachas()).resolves.toEqual([...machines, legacy[1], legacy[3]]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/gacha?catalog=category`,
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/gacha`,
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
  });

  it('still shows the decoration boxes when the legacy list fails', async () => {
    global.fetch = jest.fn(async (url: string) =>
      url.endsWith('?catalog=category')
        ? respond(machines)
        : { ok: false, status: 500, text: async () => '{}' },
    ) as unknown as typeof fetch;
    await expect(fetchGachas()).resolves.toEqual(machines);
  });
});
