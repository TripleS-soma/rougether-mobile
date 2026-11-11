import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { getSessionUserId } from '@/api';
import { useChristmasEvent } from '@/hooks/use-christmas-event';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';
import { jsonRes } from '@/test-utils/fetch';
import { queryKeys } from '@/lib/query-keys';
import * as datetime from '@/utils/datetime';

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
  jest.restoreAllMocks();
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
  const next = {
    ...STATUS,
    progressDays: 5,
    availableToday: false,
    checkedInToday: true,
    checkInDates: [datetime.todayIso()],
  };
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
            checkInDates: checked ? [datetime.todayIso()] : [],
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
          status: {
            ...STATUS,
            progressDays: 5,
            checkedInToday: true,
            checkInDates: [datetime.todayIso()],
          },
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

it.each([
  ['2026-11-09T14:59:59.999Z', '2026-11-09T14:59:59.999Z', false],
  ['2026-11-09T15:00:00.000Z', '2026-11-09T14:59:59.999Z', false],
  ['2026-11-09T14:59:59.999Z', '2026-11-09T15:00:00.000Z', false],
  ['2026-11-09T15:00:00.000Z', '2026-11-09T15:00:00.000Z', true],
] as const)(
  'checks both query timestamps against the KST day (%s / %s)',
  async (metadataAt, attendanceAt, expected) => {
    jest.spyOn(datetime, 'todayIso').mockReturnValue('2026-11-10');
    global.fetch = jest.fn() as unknown as typeof fetch;
    const env = wrapper();
    env.client.setQueryData(queryKeys.christmas(7), EVENT, { updatedAt: Date.parse(metadataAt) });
    env.client.setQueryData(queryKeys.attendanceEvent(7, 30), STATUS, {
      updatedAt: Date.parse(attendanceAt),
    });
    const { result, unmount } = await renderHook(() => useChristmasEvent({ enabled: false }), {
      wrapper: env.wrapper,
    });
    expect(result.current.loaded).toBe(true);
    expect(result.current.freshForToday).toBe(expected);
    expect(global.fetch).not.toHaveBeenCalled();
    await unmount();
  },
);

it('recomputes freshness on a midnight parent render while preserving action references', async () => {
  const day = jest.spyOn(datetime, 'todayIso').mockReturnValue('2026-11-09');
  global.fetch = jest.fn() as unknown as typeof fetch;
  const env = wrapper();
  env.client.setQueryData(queryKeys.christmas(7), EVENT, {
    updatedAt: Date.parse('2026-11-09T14:59:59.999Z'),
  });
  env.client.setQueryData(queryKeys.attendanceEvent(7, 30), STATUS, {
    updatedAt: Date.parse('2026-11-09T14:59:59.999Z'),
  });
  const { result, rerender, unmount } = await renderHook(
    () => useChristmasEvent({ enabled: false }),
    { wrapper: env.wrapper },
  );
  expect(result.current.freshForToday).toBe(true);
  const refresh = result.current.refresh;
  const checkIn = result.current.checkIn;
  day.mockReturnValue('2026-11-10');
  await rerender(undefined);
  expect(result.current.freshForToday).toBe(false);
  expect(result.current.refresh).toBe(refresh);
  expect(result.current.checkIn).toBe(checkIn);
  await act(() => {
    env.client.setQueryData(queryKeys.christmas(7), EVENT, {
      updatedAt: Date.parse('2026-11-09T15:00:00.000Z'),
    });
    env.client.setQueryData(queryKeys.attendanceEvent(7, 30), STATUS, {
      updatedAt: Date.parse('2026-11-09T15:00:00.000Z'),
    });
  });
  await waitFor(() => expect(result.current.freshForToday).toBe(true));
  expect(result.current.refresh).toBe(refresh);
  expect(result.current.checkIn).toBe(checkIn);
  expect(global.fetch).not.toHaveBeenCalled();
  await unmount();
});

it.each([[['2026-11-10']], [undefined]] as const)(
  'rejects an old or absent checked date despite a response timestamp after KST midnight (%s)',
  async (checkedDates) => {
    jest.spyOn(datetime, 'todayIso').mockReturnValue('2026-11-11');
    global.fetch = jest.fn() as unknown as typeof fetch;
    const env = wrapper();
    const receivedToday = Date.parse('2026-11-10T15:00:00.010Z');
    env.client.setQueryData(queryKeys.christmas(7), EVENT, { updatedAt: receivedToday });
    env.client.setQueryData(
      queryKeys.attendanceEvent(7, 30),
      {
        ...STATUS,
        checkedInToday: true,
        availableToday: false,
        checkInDates: checkedDates,
      },
      { updatedAt: receivedToday },
    );
    const { result, unmount } = await renderHook(() => useChristmasEvent({ enabled: false }), {
      wrapper: env.wrapper,
    });
    expect(result.current.loaded).toBe(true);
    expect(result.current.freshForToday).toBe(false);
    await act(() =>
      env.client.setQueryData(
        queryKeys.attendanceEvent(7, 30),
        {
          ...STATUS,
          checkedInToday: true,
          availableToday: false,
          checkInDates: ['2026-11-11'],
        },
        { updatedAt: receivedToday + 1 },
      ),
    );
    await waitFor(() => expect(result.current.freshForToday).toBe(true));
    await act(() =>
      env.client.setQueryData(
        queryKeys.attendanceEvent(7, 30),
        {
          ...STATUS,
          checkedInToday: false,
          availableToday: true,
          checkInDates: ['2026-11-10'],
        },
        { updatedAt: receivedToday + 2 },
      ),
    );
    await waitFor(() => expect(result.current.status?.availableToday).toBe(true));
    expect(result.current.freshForToday).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    await unmount();
  },
);

const FOX_REWARD = {
  day: 3,
  characterId: 99,
  name: '여우',
  assetKey: 'characters/fox/base-v1.webp',
  received: false,
  claimable: true,
};

it('claims a past day-3 reward once without checking in or changing coins', async () => {
  let received = false;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const status = {
      ...STATUS,
      characterReward: { ...FOX_REWARD, received, claimable: !received },
    };
    if (init?.method === 'POST') {
      expect(url).toMatch(/\/attendance\/30\/character-reward$/);
      received = true;
      return jsonRes({
        grantedNow: true,
        status: { ...status, characterReward: { ...FOX_REWARD, received: true, claimable: false } },
      });
    }
    return jsonRes(url.endsWith('/christmas') ? EVENT : status);
  }) as unknown as typeof fetch;
  const env = wrapper();
  const invalidate = jest.spyOn(env.client, 'invalidateQueries');
  const { result, rerender, unmount } = await renderHook(() => useChristmasEvent(), {
    wrapper: env.wrapper,
  });
  await waitFor(() => expect(result.current.status?.characterReward?.received).toBe(true));
  await rerender({});
  await act(() => result.current.refresh());
  expect(
    (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1);
  expect(result.current.status).toMatchObject({ progressDays: 4, checkedInToday: false });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.myCharacters.byUser(7) });
  expect(env.client.getQueryData(queryKeys.wallet(7))).toBeUndefined();
  await unmount();
});

it.each([false, true])(
  'recovers a character claim response loss (persisted=%s) without automatic POST retry',
  async (persisted) => {
    let received = false;
    let attempts = 0;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        attempts++;
        received = persisted || attempts > 1;
        if (attempts === 1) throw new TypeError('Network request failed');
        return jsonRes({
          grantedNow: true,
          status: {
            ...STATUS,
            characterReward: { ...FOX_REWARD, received: true, claimable: false },
          },
        });
      }
      return jsonRes(
        url.endsWith('/christmas')
          ? EVENT
          : { ...STATUS, characterReward: { ...FOX_REWARD, received, claimable: !received } },
      );
    }) as unknown as typeof fetch;
    const env = wrapper();
    const { result, unmount } = await renderHook(() => useChristmasEvent(), {
      wrapper: env.wrapper,
    });
    await waitFor(() => expect(attempts).toBe(1));
    await waitFor(() => expect(result.current.checkingIn).toBe(false));
    expect(result.current.status?.characterReward?.received).toBe(persisted);
    await act(() => result.current.refresh());
    expect(attempts).toBe(1);
    if (!persisted) {
      await act(async () =>
        expect((await result.current.claimCharacter()).result?.grantedNow).toBe(true),
      );
      expect(attempts).toBe(2);
    }
    await unmount();
  },
);

it('waits for an old-account claim to settle before claiming the new account reward', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const claimedFor: number[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const requestUser = getSessionUserId()!;
    if (init?.method === 'POST') {
      claimedFor.push(requestUser);
      if (requestUser === 7) await pending;
      return jsonRes({
        grantedNow: true,
        status: { ...STATUS, characterReward: { ...FOX_REWARD, received: true, claimable: false } },
      });
    }
    return jsonRes(url.endsWith('/christmas') ? EVENT : { ...STATUS, characterReward: FOX_REWARD });
  }) as unknown as typeof fetch;
  const env = wrapper();
  const { result, rerender, unmount } = await renderHook(() => useChristmasEvent(), {
    wrapper: env.wrapper,
  });
  await waitFor(() => expect(claimedFor).toEqual([7]));
  jest.mocked(getSessionUserId).mockReturnValue(8);
  await rerender({});
  await waitFor(() => expect(result.current.status?.characterReward?.claimable).toBe(true));
  expect(claimedFor).toEqual([7]);
  await act(async () => {
    finish();
  });
  await waitFor(() => expect(claimedFor).toEqual([7, 8]));
  await waitFor(() => expect(result.current.status?.characterReward?.received).toBe(true));
  expect(env.client.getQueryData(queryKeys.attendanceEvent(7, 30))).toMatchObject({
    characterReward: { received: false },
  });
  await unmount();
});
