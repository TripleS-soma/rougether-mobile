import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useGacha } from '@/hooks/use-gacha';
import { useMyCharacters } from '@/hooks/use-my-characters';
import { useShop } from '@/hooks/use-shop';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const MACHINES = {
  items: [
    { gachaId: 81, code: 'wallpaper_gacha', category: 'WALLPAPER', name: '벽지 뽑기', themeId: null, costCurrencyType: 'COIN', costAmount: 100 }, // prettier-ignore
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

describe('useGacha', () => {
  it('loads the machine list on mount', async () => {
    global.fetch = jest.fn(async () => res(MACHINES)) as unknown as typeof fetch;

    const { result } = await renderHook(() => useGacha(jest.fn()), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(false);
    expect(result.current.gachas).toHaveLength(1);
  });

  // 로드 실패는 빈 상태('뽑기 없음')로 위장하지 않는다 (#549).
  it('로드 실패 시 error, 재시도 성공 시 해제된다 (#549)', async () => {
    let broken = true;
    global.fetch = jest.fn(async () => {
      if (broken) return { ok: false, status: 500, text: async () => '{}' };
      return res(MACHINES);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useGacha(jest.fn()), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.gachas).toEqual([]);

    broken = false;
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.error).toBe(false));
    await waitFor(() => expect(result.current.gachas).toHaveLength(1));
  });

  it('keeps legacy theme lists empty instead of assigning their prices to category boxes', async () => {
    global.fetch = jest.fn(async () =>
      res({ items: [{ gachaId: 2, code: 'forest_sage', themeId: 1, costAmount: 300 }] }),
    ) as unknown as typeof fetch;
    const { result } = await renderHook(() => useGacha(jest.fn()), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(false);
    expect(result.current.gachas).toEqual([]);
  });

  it.each([1, 6] as const)(
    'sends count %s to the real server machine ID and syncs the returned wallet',
    async (count) => {
      const rewards = [{ rewardType: 'ITEM', itemId: 32, name: '새 벽지' }];
      const onWallet = jest.fn();
      global.fetch = jest.fn(async (url: string) =>
        url.endsWith('/draw')
          ? res({
              results: rewards,
              wallets: [
                { currencyType: 'COIN', balance: 500 },
                { currencyType: 'DIAMOND', balance: 8 },
              ],
            })
          : res(MACHINES),
      ) as unknown as typeof fetch;
      const { result } = await renderHook(() => useGacha(onWallet), { wrapper: queryWrapper() });
      await waitFor(() => expect(result.current.gachas).toHaveLength(1));
      await act(async () => {
        expect(await result.current.draw(result.current.gachas[0].id, count)).toEqual(rewards);
      });
      await flushQueryNotifications();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/gacha\/81\/draw$/),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ count }) }),
      );
      expect(onWallet).toHaveBeenCalledWith({ coin: 500, diamond: 8 });
    },
  );

  it('blocks same-tick duplicate draws and releases the lock after completion', async () => {
    let finishDraw!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      finishDraw = resolve;
    });
    global.fetch = jest.fn(async (url: string) => {
      if (!url.endsWith('/draw')) return res(MACHINES);
      await responseReady;
      return res({ results: [{ itemId: 32 }] });
    }) as unknown as typeof fetch;
    const { result } = await renderHook(() => useGacha(jest.fn()), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.gachas).toHaveLength(1));
    await act(async () => {
      const firstDraw = result.current.draw(81);
      expect(await result.current.draw(81)).toBeNull();
      finishDraw();
      expect(await firstDraw).toEqual([{ itemId: 32 }]);
    });
    const drawCalls = () =>
      (global.fetch as jest.Mock).mock.calls.filter(([url]) => url.endsWith('/draw'));
    expect(drawCalls()).toHaveLength(1);
    await act(async () => {
      await result.current.draw(81);
    });
    await flushQueryNotifications();
    expect(drawCalls()).toHaveLength(2);
  });

  it('does not retry a failed spending request and permits a later explicit attempt', async () => {
    global.fetch = jest.fn(async (url: string) =>
      url.endsWith('/draw') ? { ok: false, status: 500, text: async () => '{}' } : res(MACHINES),
    ) as unknown as typeof fetch;
    const onWallet = jest.fn();
    const { result } = await renderHook(() => useGacha(onWallet), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.draw(81)).toBeNull();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(onWallet).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current.draw(81)).toBeNull();
    });
    await flushQueryNotifications();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('keeps returned references stable while invoking the latest wallet callback', async () => {
    global.fetch = jest.fn(async (url: string) =>
      url.endsWith('/draw')
        ? res({ results: [], wallets: [{ currencyType: 'COIN', balance: 90 }] })
        : res(MACHINES),
    ) as unknown as typeof fetch;
    const originalCallback = jest.fn();
    const latestCallback = jest.fn();
    const { result, rerender } = await renderHook(
      ({ onWallet }: { onWallet: typeof originalCallback }) => useGacha(onWallet),
      {
        initialProps: { onWallet: originalCallback },
        wrapper: queryWrapper(),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const initial = result.current;
    await rerender({ onWallet: latestCallback });
    expect(result.current).toBe(initial);
    await act(async () => {
      await initial.draw(81);
    });
    await flushQueryNotifications();
    expect(latestCallback).toHaveBeenCalledWith({ coin: 90, diamond: 0 });
    expect(originalCallback).not.toHaveBeenCalled();
    expect(result.current.draw).toBe(initial.draw);
    expect(result.current.retry).toBe(initial.retry);
  });

  /**
   * 뽑기 후 재조회는 셸이 아니라 훅이 한다 (#1027) — 셸의 `refreshOwned()`·
   * `reloadMyCharacters()` 두 줄이 없어도 인벤토리·캐릭터 쿼리가 다시 받는다.
   */
  describe('뽑기 성공 → 인벤토리·캐릭터 쿼리 무효화 (#1027)', () => {
    const ITEMS = {
      items: [
        { id: 32, name: '새 벽지', categoryCode: 'wallpaper', priceAmount: 100, owned: false },
      ],
    };
    const CHARACTERS = {
      items: [{ userCharacterId: 11, characterId: 1, code: 'cat', name: '고양이', selected: true }],
    };
    const inventoryCalls = () =>
      (global.fetch as jest.Mock).mock.calls.filter(([url]) => url.includes('/me/items'));
    const characterCalls = () =>
      (global.fetch as jest.Mock).mock.calls.filter(([url]) => url.includes('/me/characters'));

    const setUp = (results: unknown[]) => {
      let drawn = false;
      global.fetch = jest.fn(async (url: string) => {
        if (url.endsWith('/draw')) {
          drawn = true;
          return res({ results });
        }
        if (url.includes('/me/items'))
          return res({ items: drawn ? [{ itemId: 32, userItemId: 320 }] : [] });
        if (url.includes('/me/characters'))
          return res(
            drawn
              ? { items: [...CHARACTERS.items, { userCharacterId: 12, characterId: 4, code: 'panda', name: '판다', selected: false }] } // prettier-ignore
              : CHARACTERS,
          );
        if (url.includes('/rooms/me')) return res({});
        if (url.includes('/items')) return res(ITEMS);
        return res(MACHINES);
      }) as unknown as typeof fetch;
    };
    // 셸처럼 세 훅이 같은 캐시를 본다 — 셸은 뽑기 결과를 넘길 뿐 아무것도 재조회하지 않는다.
    const useShell = () => ({
      gacha: useGacha(jest.fn()),
      shop: useShop(jest.fn()),
      characters: useMyCharacters(),
    });
    const settled = async (result: { current: ReturnType<typeof useShell> }) => {
      await waitFor(() => expect(result.current.gacha.loading).toBe(false));
      await waitFor(() => expect(result.current.shop.loading).toBe(false));
      await waitFor(() => expect(result.current.characters.characters).toHaveLength(1));
    };

    it('아이템을 뽑으면 인벤토리만 다시 받아 보유중이 된다', async () => {
      setUp([{ rewardType: 'ITEM', itemId: 32 }]);
      const { result } = await renderHook(useShell, { wrapper: queryWrapper() });
      await settled(result);
      expect(result.current.shop.ownedIds).toEqual([]);
      expect(inventoryCalls()).toHaveLength(1);

      await act(async () => {
        await result.current.gacha.draw(81);
      });

      await waitFor(() => expect(result.current.shop.ownedIds).toEqual(['32']));
      expect(inventoryCalls()).toHaveLength(2);
      expect(characterCalls()).toHaveLength(1);
    });

    it('캐릭터를 뽑으면 보유 캐릭터를 다시 받아 피커에 뜬다', async () => {
      setUp([{ rewardType: 'CHARACTER', characterId: 4 }]);
      const { result } = await renderHook(useShell, { wrapper: queryWrapper() });
      await settled(result);

      await act(async () => {
        await result.current.gacha.draw(81);
      });

      await waitFor(() => expect(result.current.characters.characters).toHaveLength(2));
      expect(characterCalls()).toHaveLength(2);
      expect(inventoryCalls()).toHaveLength(1);
    });

    it('중복이라 재화로 바뀐 보상은 아무것도 다시 받지 않는다', async () => {
      setUp([{ rewardType: 'ITEM', itemId: 32, converted: true }]);
      const { result } = await renderHook(useShell, { wrapper: queryWrapper() });
      await settled(result);

      await act(async () => {
        await result.current.gacha.draw(81);
      });
      await flushQueryNotifications();

      expect(inventoryCalls()).toHaveLength(1);
      expect(characterCalls()).toHaveLength(1);
    });
  });
});
