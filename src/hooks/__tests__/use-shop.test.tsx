import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useShop } from '@/hooks/use-shop';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const ITEMS = {
  items: [
    { id: 1, name: '침대', categoryCode: 'furniture', placementType: 'positioned', defaultSlot: 'bottomLeft', priceAmount: 100, assetKey: 'items/a/bed.png', owned: true }, // prettier-ignore
    { id: 2, name: '선반', categoryCode: 'furniture', placementType: 'positioned', defaultSlot: 'topLeft', priceAmount: 100, assetKey: 'items/a/shelf.png', owned: false }, // prettier-ignore
  ],
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

/**
 * react-query는 뮤테이션 결과 알림을 `notifyManager`로 배칭한다(setTimeout 0) —
 * act 안의 await만으로는 안 비워져 마지막 단언 뒤에 렌더가 새면 act 경고가 난다.
 */
const flushQueryNotifications = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
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

    const { result } = await renderHook(() => useShop(jest.fn()), { wrapper: queryWrapper() });
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

    const { result } = await renderHook(() => useShop(jest.fn()), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.placement.items).toEqual([]);
  });

  it('아직 SLOT_V1인 방도 슬롯으로 되돌아가지 않는다 (#925)', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/me/items')) {
        return res({ items: [{ itemId: 1, userItemId: 11 }] });
      }
      if (url.includes('/rooms/me')) {
        // 전환 전 방 — 서버가 남겨둔 positioned 슬롯이 그대로 실려 온다.
        return res({
          layoutFormat: 'SLOT_V1',
          placements: [],
          slots: [{ slotType: 'bottomLeft', userItemId: 11 }],
        });
      }
      if (url.includes('/items')) return res(ITEMS);
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useShop(jest.fn()), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 예전엔 여기서 슬롯을 앵커 좌표로 프리필했다. 이제 가구는 placements가 정본이다.
    expect(result.current.placement.items).toEqual([]);
  });
});

describe('useShop — 구매·배치 저장은 캐시에 쓴다 (#1027)', () => {
  const setUp = (layoutResponse: { ok: boolean; status: number; body: unknown }) => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/items/2/purchase'))
        return res({ itemId: 2, userItemId: 22, wallet: { currencyType: 'DIAMOND', balance: 5 } });
      if (url.includes('/rooms/me/layout')) {
        return {
          ok: layoutResponse.ok,
          status: layoutResponse.status,
          text: async () => JSON.stringify(layoutResponse.body),
        };
      }
      if (url.includes('/me/items')) return res({ items: [{ itemId: 1, userItemId: 11 }] });
      if (url.includes('/rooms/me')) return res({ layoutFormat: 'FREE_V1', layoutRevision: 3 });
      if (url.includes('/items')) return res(ITEMS);
      return res({ items: [] });
    }) as unknown as typeof fetch;
  };

  it('구매 → 보유중이 되고, 재조회 없이 그 아이템을 배치 저장할 수 있다', async () => {
    setUp({ ok: true, status: 200, body: { layoutRevision: 4 } });
    const setWallet = jest.fn();
    const { result } = await renderHook(() => useShop(setWallet), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ownedIds).toEqual(['1']);

    await act(async () => {
      expect(await result.current.purchase('2')).toBe(true);
    });
    await waitFor(() => expect(result.current.ownedIds).toEqual(['1', '2']));
    expect(setWallet).toHaveBeenCalled();
    // 인벤토리는 구매 응답으로 채웠다 — /me/items를 다시 받지 않는다.
    const myItemsCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      (url as string).includes('/me/items'),
    );
    expect(myItemsCalls).toHaveLength(1);

    await act(async () => {
      expect(
        await result.current.saveLayout([{ furnitureId: '2', x: 0.4, y: 0.6, z: 1 }], '1'),
      ).toBe('ok');
    });
    const put = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
      (url as string).includes('/rooms/me/layout'),
    );
    const body = JSON.parse(put?.[1]?.body as string);
    expect(body.baseRevision).toBe(3);
    // 방금 산 아이템의 userItemId(22)를 안다.
    expect(body.placements).toEqual([expect.objectContaining({ userItemId: 22 })]);
    // 저장 결과가 placement에 바로 반영된다 — 리비전은 응답값, 가구는 보낸 배치.
    await waitFor(() => expect(result.current.placement.layoutRevision).toBe(4));
    expect(result.current.placement.items).toEqual([
      expect.objectContaining({ furnitureId: '2', x: 0.4, y: 0.6 }),
    ]);
  });

  it('409(리비전 충돌) → conflict, placement는 그대로', async () => {
    setUp({ ok: false, status: 409, body: { code: 'ROOM_LAYOUT_REVISION_CONFLICT' } });
    const { result } = await renderHook(() => useShop(jest.fn()), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.placement;

    await act(async () => {
      expect(await result.current.saveLayout([], '1')).toBe('conflict');
    });
    await flushQueryNotifications();
    expect(result.current.placement).toBe(before);
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
    const { result } = await renderHook(() => useShop(setWallet), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.placement.cobweb).not.toBeNull());

    let reward: number | null = null;
    await act(async () => {
      reward = await result.current.cleanCobweb();
    });

    expect(reward).toBe(3);
    await waitFor(() => expect(result.current.placement.cobweb).toBeNull());
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
    const { result } = await renderHook(() => useShop(setWallet), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.placement.cobweb).not.toBeNull());

    let reward: number | null = 999;
    await act(async () => {
      reward = await result.current.cleanCobweb();
    });

    expect(reward).toBeNull();
    await waitFor(() => expect(result.current.placement.cobweb).toBeNull());
    expect(setWallet).not.toHaveBeenCalled();
  });

  it('그 밖의 실패 → null, 거미줄은 그대로 남는다', async () => {
    setUp({ ok: false, status: 500, body: {} });
    const { result } = await renderHook(() => useShop(jest.fn()), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.placement.cobweb).not.toBeNull());

    let reward: number | null = 999;
    await act(async () => {
      reward = await result.current.cleanCobweb();
    });

    await flushQueryNotifications();
    expect(reward).toBeNull();
    expect(result.current.placement.cobweb).not.toBeNull();
  });
});

it('loads and refreshes personal AI furniture that is not sold in the public shop', async () => {
  let created = false;
  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('/me/items'))
      return res({
        items: created
          ? [
              {
                itemId: 99,
                userItemId: 199,
                name: '내가 만든 의자',
                assetKey: 'items/generated/chair.png',
                categoryCode: 'furniture',
                placementType: 'positioned',
                defaultSlot: 'midRight',
              },
            ]
          : [],
      });
    if (url.includes('/rooms/me')) return res({ slots: [] });
    if (url.includes('/items')) return res(ITEMS);
    return res({ items: [] });
  }) as unknown as typeof fetch;
  const first = await renderHook(() => useShop(jest.fn()), { wrapper: queryWrapper() });
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  created = true;
  await act(async () => {
    expect(await first.result.current.refreshOwned()).toBe(true);
  });
  await waitFor(() =>
    expect(first.result.current.catalogue.furniture).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '99', assetKey: 'items/generated/chair.png' }),
      ]),
    ),
  );
  expect(first.result.current.ownedIds).toContain('99');
  await first.unmount();
  const reopened = await renderHook(() => useShop(jest.fn()), { wrapper: queryWrapper() });
  await waitFor(() => expect(reopened.result.current.loading).toBe(false));
  expect(reopened.result.current.catalogue.furniture.map((item) => item.id)).toContain('99');
});
