import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useGacha } from '@/hooks/use-gacha';
import { queryWrapper } from '@/test-utils/query-wrapper';

const res = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});

const MACHINES = {
  items: [
    { gachaId: 81, code: 'wallpaper_gacha', category: 'WALLPAPER', name: '벽지 뽑기', themeId: null, costCurrencyType: 'COIN', costAmount: 100 }, // prettier-ignore
  ],
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
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
    expect(latestCallback).toHaveBeenCalledWith({ coin: 90, diamond: 0 });
    expect(originalCallback).not.toHaveBeenCalled();
    expect(result.current.draw).toBe(initial.draw);
    expect(result.current.retry).toBe(initial.retry);
  });
});
