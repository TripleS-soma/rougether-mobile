import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { getSessionUserId, type LoginGift } from '@/api';
import { isPeperoDay, PEPERO_END, PEPERO_START, usePeperoGift } from '@/hooks/use-pepero-gift';
import { useWallet } from '@/hooks/use-wallet';
import { queryKeys } from '@/lib/query-keys';
import { jsonRes } from '@/test-utils/fetch';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api', () => ({ ...jest.requireActual('@/api'), getSessionUserId: jest.fn(() => 7) }));
jest.mock('@/hooks/use-wallet');
const gift: LoginGift = {
  participationId: 62,
  code: 'PEPERO_DAY_20261111',
  title: '빼빼로데이',
  eligibleAt: '2026-11-11T00:00:00+09:00',
  grantedAt: '2026-11-11T00:00:01+09:00',
  acknowledgedAt: null,
  coinAmount: 111,
  reward: { itemId: 238, name: '11:11 소원 관측기', assetKey: 'wish.png', userItemId: 900 },
};
const refreshWallet = jest.fn();
const realFetch = global.fetch;
const clients: ReturnType<typeof createTestQueryClient>[] = [];
function env() {
  const client = createTestQueryClient();
  clients.push(client);
  return { client, wrapper: queryWrapper(client) };
}
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(PEPERO_START + 60_000);
  jest.mocked(getSessionUserId).mockReturnValue(7);
  jest
    .mocked(useWallet)
    .mockReturnValue({ refreshWallet, setWallet: jest.fn(), wallet: { coin: 0, diamond: 0 } });
  refreshWallet.mockReset();
});
afterEach(async () => {
  await cleanup();
  global.fetch = realFetch;
  clients.forEach((client) => client.clear());
  clients.length = 0;
  jest.restoreAllMocks();
});

it('uses KST Nov 11 boundaries and makes no request outside the event', async () => {
  expect(isPeperoDay(PEPERO_START - 1)).toBe(false);
  expect(isPeperoDay(PEPERO_START)).toBe(true);
  expect(isPeperoDay(PEPERO_END - 1)).toBe(true);
  expect(isPeperoDay(PEPERO_END)).toBe(false);
  jest.mocked(Date.now).mockReturnValue(PEPERO_END);
  global.fetch = jest.fn();
  const { result } = await renderHook(() => usePeperoGift({ enabled: true }), {
    wrapper: env().wrapper,
  });
  expect(result.current.gift).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('waits for a committed grant, then refreshes wallet and inventory once', async () => {
  global.fetch = jest.fn(async () =>
    jsonRes({
      gifts: [{ ...gift, grantedAt: null, reward: { ...gift.reward, userItemId: null } }],
    }),
  ) as unknown as typeof fetch;
  const e = env();
  const { result } = await renderHook(() => usePeperoGift({ enabled: true }), {
    wrapper: e.wrapper,
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.gift).toBeNull();
  expect(refreshWallet).not.toHaveBeenCalled();
  await act(async () => e.client.setQueryData(queryKeys.loginGifts(7), { gifts: [gift] }));
  await waitFor(() => expect(result.current.gift?.participationId).toBe(62));
  expect(refreshWallet).toHaveBeenCalledTimes(1);
});

it('acknowledges the existing receipt without calling any grant or check-in API', async () => {
  global.fetch = jest.fn(async (_url, options) =>
    options?.method === 'POST' ? new Response(null, { status: 204 }) : jsonRes({ gifts: [gift] }),
  ) as unknown as typeof fetch;
  const { result } = await renderHook(() => usePeperoGift({ enabled: true }), {
    wrapper: env().wrapper,
  });
  await waitFor(() => expect(result.current.gift).toBeTruthy());
  let saved = false;
  await act(async () => {
    saved = await result.current.acknowledge();
  });
  expect(saved).toBe(true);
  await waitFor(() => expect(result.current.gift?.acknowledgedAt).toBeTruthy());
  const posts = (global.fetch as jest.Mock).mock.calls.filter(
    ([, init]) => init?.method === 'POST',
  );
  expect(posts).toHaveLength(1);
  expect(posts[0][0]).toMatch(/\/events\/login-gifts\/62\/acknowledgement$/);
});

it('does not expose an old account receipt after its request resolves', async () => {
  let finish!: (response: ReturnType<typeof jsonRes>) => void;
  global.fetch = jest.fn(
    () =>
      new Promise<ReturnType<typeof jsonRes>>((resolve) => {
        finish = resolve;
      }),
  ) as unknown as typeof fetch;
  const e = env();
  const { result, rerender } = await renderHook(() => usePeperoGift({ enabled: true }), {
    wrapper: e.wrapper,
  });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  jest.mocked(getSessionUserId).mockReturnValue(8);
  await act(async () => finish(jsonRes({ gifts: [gift] })));
  await rerender({});
  expect(result.current.gift).toBeNull();
  expect(refreshWallet).not.toHaveBeenCalled();
});
