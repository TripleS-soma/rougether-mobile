import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useShop } from '@/hooks/use-shop';

const res = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});

const ITEMS = {
  items: [
    { id: 1, name: '침대', categoryCode: 'furniture', placementType: 'positioned', defaultSlot: 'bottomLeft', priceAmount: 100, assetKey: 'items/a/bed.png', owned: true }, // prettier-ignore
    { id: 2, name: '선반', categoryCode: 'furniture', placementType: 'positioned', defaultSlot: 'topLeft', priceAmount: 100, assetKey: 'items/a/shelf.png', owned: false }, // prettier-ignore
  ],
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useShop — refreshOwned (가챠 획득 동기화)', () => {
  it('marks freshly drawn items as owned and learns their userItemId', async () => {
    // First inventory load: only item 1. After the "draw": items 1 + 2.
    let myItemsCall = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/me/items')) {
        myItemsCall += 1;
        return res({
          items:
            myItemsCall === 1
              ? [{ itemId: 1, userItemId: 11 }]
              : [
                  { itemId: 1, userItemId: 11 },
                  { itemId: 2, userItemId: 22 },
                ],
        });
      }
      if (url.includes('/rooms/me')) return res({ slots: [] });
      if (url.includes('/items')) return res(ITEMS);
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useShop(jest.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ownedIds).toEqual(['1']);

    // The gacha rewarded item 2 — refreshOwned re-reads the inventory.
    await act(async () => {
      await result.current.refreshOwned();
    });
    await waitFor(() => expect(result.current.ownedIds).toContain('2'));
    expect(result.current.ownedIds).toContain('1');
  });

  it('keeps an intentionally empty FREE_V1 room empty', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/me/items')) {
        return res({ items: [{ itemId: 1, userItemId: 11 }] });
      }
      if (url.includes('/rooms/me')) {
        return res({
          layoutFormat: 'FREE_V1',
          placements: [],
          slots: [{ slotType: 'bottomLeft', userItemId: 11 }],
        });
      }
      if (url.includes('/items')) return res(ITEMS);
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useShop(jest.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.placement.freeLayout).toBe(true);
    expect(result.current.placement.items).toEqual([]);
    expect(result.current.placement.placedFurnitureIds).toEqual([]);
  });
});

describe('useShop — 거미줄 청소 (#830)', () => {
  const setUp = (cleanResponse: { ok: boolean; status: number; body: unknown }) => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/rooms/me/cobweb/clean')) {
        return {
          ok: cleanResponse.ok,
          status: cleanResponse.status,
          text: async () => JSON.stringify(cleanResponse.body),
        };
      }
      if (url.includes('/me/items')) return res({ items: [] });
      if (url.includes('/rooms/me'))
        return res({ slots: [], cobweb: { assetKey: 'items/cobweb.png', cleanable: true } });
      if (url.includes('/items')) return res(ITEMS);
      return res({ items: [] });
    }) as unknown as typeof fetch;
  };

  it('청소 성공 → 받은 코인 수를 돌려주고 거미줄을 걷고 잔액을 갱신한다', async () => {
    setUp({
      ok: true,
      status: 200,
      body: { rewardCurrencyType: 'COIN', rewardAmount: 3, balance: 128 },
    });
    const setWallet = jest.fn();
    const { result } = await renderHook(() => useShop(setWallet));
    await waitFor(() => expect(result.current.placement.cobweb).not.toBeNull());

    let reward: number | null = null;
    await act(async () => {
      reward = await result.current.cleanCobweb();
    });

    expect(reward).toBe(3);
    expect(result.current.placement.cobweb).toBeNull();
    expect(setWallet).toHaveBeenCalled();
  });

  /**
   * 남이 먼저 치운 경우다. 보상은 최초 1인에게만 가므로 null을 돌려줘야
   * 화면이 코인 연출을 쏘지 않는다 — 여기서 0이나 3을 돌려주면 받지도 않은
   * 코인이 날아간다.
   */
  it('409(이미 청소됨) → null을 돌려주고 거미줄만 걷는다', async () => {
    setUp({ ok: false, status: 409, body: { code: 'ROOM_COBWEB_NOT_ACTIVE' } });
    const setWallet = jest.fn();
    const { result } = await renderHook(() => useShop(setWallet));
    await waitFor(() => expect(result.current.placement.cobweb).not.toBeNull());

    let reward: number | null = 999;
    await act(async () => {
      reward = await result.current.cleanCobweb();
    });

    expect(reward).toBeNull();
    expect(result.current.placement.cobweb).toBeNull();
    expect(setWallet).not.toHaveBeenCalled();
  });

  it('그 밖의 실패 → null, 거미줄은 그대로 남는다', async () => {
    setUp({ ok: false, status: 500, body: {} });
    const { result } = await renderHook(() => useShop(jest.fn()));
    await waitFor(() => expect(result.current.placement.cobweb).not.toBeNull());

    let reward: number | null = 999;
    await act(async () => {
      reward = await result.current.cleanCobweb();
    });

    expect(reward).toBeNull();
    expect(result.current.placement.cobweb).not.toBeNull();
  });
});
