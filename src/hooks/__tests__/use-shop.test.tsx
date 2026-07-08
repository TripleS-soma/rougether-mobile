import { renderHook, waitFor } from '@testing-library/react-native';

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
    await result.current.refreshOwned();
    await waitFor(() => expect(result.current.ownedIds).toContain('2'));
    expect(result.current.ownedIds).toContain('1');
  });
});
