import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { getSessionUserId } from '@/api';
import { useChristmasEvent } from '@/hooks/use-christmas-event';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';
import { jsonRes } from '@/test-utils/fetch';
import { queryKeys } from '@/lib/query-keys';

jest.mock('@/api', () => ({ ...jest.requireActual('@/api'), getSessionUserId: jest.fn(() => 7) }));
const EVENT = {
  code: 'christmas_2026',
  title: '크리스마스',
  active: true,
  startsOn: '2026-11-09',
  endsOn: '2026-12-25',
  gachaId: 812,
  attendanceEventId: 30,
  popupDismissed: false,
};
const STATUS = {
  eventId: 30,
  code: 'christmas_2026',
  mode: 'CUMULATIVE',
  title: '크리스마스',
  startsOn: EVENT.startsOn,
  endsOn: EVENT.endsOn,
  targetDays: 30,
  currentStreak: 1,
  progressDays: 4,
  active: true,
  availableToday: true,
  checkedInToday: false,
  completed: false,
  checkInDates: [],
  dailyRewards: [{ day: 5, coinAmount: 60, furnitureReward: false, claimed: false }],
  reward: null,
};
const realFetch = global.fetch;
const clients: ReturnType<typeof createTestQueryClient>[] = [];
function wrapper() {
  const client = createTestQueryClient();
  client.setDefaultOptions({
    queries: { retry: false, staleTime: 0, gcTime: Infinity },
    mutations: { retry: false, gcTime: Infinity },
  });
  clients.push(client);
  return { client, wrapper: queryWrapper(client) };
}
afterEach(async () => {
  await cleanup();
  global.fetch = realFetch;
  clients.forEach((client) => client.clear());
  clients.length = 0;
  jest.mocked(getSessionUserId).mockReturnValue(7);
});

it('loads the event and its explicit cumulative status without replacing progress with streak', async () => {
  global.fetch = jest.fn(async (url: string) =>
    jsonRes(url.endsWith('/christmas') ? EVENT : STATUS),
  ) as unknown as typeof fetch;
  const env = wrapper();
  const { result, unmount } = await renderHook(() => useChristmasEvent(), { wrapper: env.wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.status).toMatchObject({ progressDays: 4, currentStreak: 1 });
  expect((global.fetch as jest.Mock).mock.calls.map(([url]) => url)).toEqual([
    expect.stringMatching(/\/events\/christmas$/),
    expect.stringMatching(/\/events\/attendance\/30$/),
  ]);
  await unmount();
});

it('uses the server milestone amount and single-flights paid state changes', async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = { ...STATUS, progressDays: 5, availableToday: false, checkedInToday: true };
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      await pending;
      return jsonRes({
        newCheckIn: true,
        coinRewardAmount: 60,
        coinBalance: 160,
        rewardGrantedNow: false,
        status: next,
      });
    }
    if (url.endsWith('/wallets'))
      return jsonRes({ items: [{ currencyType: 'COIN', balance: 160 }] });
    return jsonRes(url.endsWith('/christmas') ? EVENT : STATUS);
  }) as unknown as typeof fetch;
  const env = wrapper();
  const { result, unmount } = await renderHook(() => useChristmasEvent(), { wrapper: env.wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(async () => {
    const first = result.current.checkIn();
    expect(await result.current.checkIn()).toEqual({ result: null, recovered: false });
    release();
    expect((await first).result?.coinRewardAmount).toBe(60);
  });
  await waitFor(() => expect(result.current.status?.progressDays).toBe(5));
  expect(
    (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1);
  expect(env.client.getQueryData(queryKeys.wallet(7))).toMatchObject({ coin: 160 });
  await unmount();
});

it('reconciles a persisted response loss with GET, wallet and inventory without another POST', async () => {
  let checked = false;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      checked = true;
      throw new TypeError('Network request failed');
    }
    if (url.endsWith('/wallets'))
      return jsonRes({ items: [{ currencyType: 'COIN', balance: 160 }] });
    return jsonRes(
      url.endsWith('/christmas')
        ? EVENT
        : {
            ...STATUS,
            checkedInToday: checked,
            availableToday: !checked,
            progressDays: checked ? 5 : 4,
          },
    );
  }) as unknown as typeof fetch;
  const env = wrapper();
  const invalidate = jest.spyOn(env.client, 'invalidateQueries');
  const { result, unmount } = await renderHook(() => useChristmasEvent(), { wrapper: env.wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(async () =>
    expect(await result.current.checkIn()).toEqual({ result: null, recovered: true }),
  );
  await waitFor(() => expect(result.current.status?.checkedInToday).toBe(true));
  expect(
    (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.myItems.all });
  await unmount();
});

it('keeps failed permanent dismissal visible and persists only after a successful server response', async () => {
  let fail = true;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      if (fail) throw new TypeError('Network request failed');
      return { ok: true, status: 204, text: async () => '' };
    }
    return jsonRes(url.endsWith('/christmas') ? EVENT : STATUS);
  }) as unknown as typeof fetch;
  const env = wrapper();
  const { result, unmount } = await renderHook(() => useChristmasEvent(), { wrapper: env.wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(async () => expect(await result.current.dismissPopup()).toBe(false));
  expect(result.current.event?.popupDismissed).toBe(false);
  fail = false;
  await act(async () => expect(await result.current.dismissPopup()).toBe(true));
  await waitFor(() => expect(result.current.event?.popupDismissed).toBe(true));
  await unmount();
});

it('never checks in an inactive/finished status or fetches without an authenticated user', async () => {
  global.fetch = jest.fn(async (url: string) =>
    jsonRes(
      url.endsWith('/christmas')
        ? { ...EVENT, active: false }
        : { ...STATUS, active: false, availableToday: false },
    ),
  ) as unknown as typeof fetch;
  const env = wrapper();
  const { result, unmount } = await renderHook(() => useChristmasEvent(), { wrapper: env.wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  await act(async () =>
    expect(await result.current.checkIn()).toEqual({ result: null, recovered: false }),
  );
  expect((global.fetch as jest.Mock).mock.calls.every(([, init]) => init?.method === 'GET')).toBe(
    true,
  );
  await unmount();
  jest.mocked(getSessionUserId).mockReturnValue(undefined);
  jest.mocked(global.fetch).mockClear();
  const unauth = await renderHook(() => useChristmasEvent(), { wrapper: wrapper().wrapper });
  expect(global.fetch).not.toHaveBeenCalled();
  await unauth.unmount();
});

it.each(['success', 'failure'])(
  'ignores an in-flight check-in %s after an account switch',
  async (outcome) => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let foreignOldEventReads = 0;
    let walletReads = 0;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        await pending;
        if (outcome === 'failure') throw new TypeError('Network request failed');
        return jsonRes({
          newCheckIn: true,
          coinRewardAmount: 60,
          coinBalance: 160,
          rewardGrantedNow: false,
          status: { ...STATUS, progressDays: 5, checkedInToday: true },
        });
      }
      const currentUser = getSessionUserId();
      if (url.endsWith('/wallets')) {
        walletReads += 1;
        return jsonRes({ items: [] });
      }
      if (url.endsWith('/christmas'))
        return jsonRes({ ...EVENT, attendanceEventId: currentUser === 8 ? 31 : 30 });
      if (url.endsWith('/30') && currentUser === 8) foreignOldEventReads += 1;
      return jsonRes(currentUser === 8 ? { ...STATUS, eventId: 31, progressDays: 17 } : STATUS);
    }) as unknown as typeof fetch;
    const env = wrapper();
    const { result, unmount } = await renderHook(() => useChristmasEvent(), {
      wrapper: env.wrapper,
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let action!: ReturnType<typeof result.current.checkIn>;
    await act(() => {
      action = result.current.checkIn();
    });
    jest.mocked(getSessionUserId).mockReturnValue(8);
    await act(async () => {
      finish();
      expect(await action).toEqual({ result: null, recovered: false });
    });
    await waitFor(() => expect(result.current.status?.eventId).toBe(31));
    expect(foreignOldEventReads).toBe(0);
    expect(walletReads).toBe(0);
    expect(env.client.getQueryData(queryKeys.wallet(8))).toBeUndefined();
    expect(env.client.getQueryData(queryKeys.attendanceEvent(7, 30))).toMatchObject({
      progressDays: 4,
    });
    await unmount();
  },
);

it('does not mark either account dismissed when a pending dismissal returns after account replacement', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      await pending;
      return { ok: true, status: 204, text: async () => '' };
    }
    return jsonRes(url.endsWith('/christmas') ? EVENT : STATUS);
  }) as unknown as typeof fetch;
  const env = wrapper();
  const { result, unmount } = await renderHook(() => useChristmasEvent(), { wrapper: env.wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  let action!: Promise<boolean>;
  await act(() => {
    action = result.current.dismissPopup();
  });
  jest.mocked(getSessionUserId).mockReturnValue(8);
  await act(async () => {
    finish();
    expect(await action).toBe(false);
  });
  expect(env.client.getQueryData(queryKeys.christmas(7))).toMatchObject({ popupDismissed: false });
  await waitFor(() => expect(env.client.getQueryData(queryKeys.christmas(8))).toBeDefined());
  expect(
    (env.client.getQueryData(queryKeys.christmas(8)) as { popupDismissed?: boolean } | undefined)
      ?.popupDismissed,
  ).not.toBe(true);
  await unmount();
});

it('stops an old-account refresh before requesting its attendance with a replacement session', async () => {
  let finish!: () => void;
  let delay = false;
  let foreignOldEventReads = 0;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  global.fetch = jest.fn(async (url: string) => {
    const requestUser = getSessionUserId();
    if (url.endsWith('/christmas')) {
      if (delay && requestUser === 7) await pending;
      return jsonRes({ ...EVENT, attendanceEventId: requestUser === 8 ? 31 : 30 });
    }
    if (url.endsWith('/30') && requestUser === 8) foreignOldEventReads += 1;
    return jsonRes(requestUser === 8 ? { ...STATUS, eventId: 31, progressDays: 17 } : STATUS);
  }) as unknown as typeof fetch;
  const env = wrapper();
  const { result, unmount } = await renderHook(() => useChristmasEvent(), { wrapper: env.wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  delay = true;
  let action!: ReturnType<typeof result.current.refresh>;
  await act(() => {
    action = result.current.refresh();
  });
  jest.mocked(getSessionUserId).mockReturnValue(8);
  await act(async () => {
    finish();
    expect(await action).toBeNull();
  });
  await waitFor(() => expect(result.current.status?.eventId).toBe(31));
  expect(foreignOldEventReads).toBe(0);
  expect(env.client.getQueryData(queryKeys.attendanceEvent(7, 30))).toMatchObject({
    progressDays: 4,
  });
  await unmount();
});
