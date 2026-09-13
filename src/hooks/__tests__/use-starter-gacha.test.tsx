import { act, renderHook, waitFor } from '@testing-library/react-native';
import { drawStarterGacha, fetchStarterGacha } from '@/api/starter-gacha';
import { useStarterGacha } from '@/hooks/use-starter-gacha';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';
import type { DrawResult, GachaDrawResponse } from '@/api/types';
import { getSessionUserId } from '@/api';
import { queryKeys } from '@/lib/query-keys';

jest.mock('@/api/starter-gacha');
const fetchState = jest.mocked(fetchStarterGacha);
const drawApi = jest.mocked(drawStarterGacha);
const reward: DrawResult = {
  rewardType: 'ITEM',
  itemId: 700,
  name: '포근한 스피커',
  converted: false,
};
const pending = { state: 'PENDING' as const, reward };
const claimed = { state: 'CLAIMED' as const, reward };
beforeEach(() => {
  jest.resetAllMocks();
  fetchState.mockResolvedValue(pending);
});

it('grants once, refreshes inventory and recovers the same result without a second POST', async () => {
  const client = createTestQueryClient();
  const inventoryKey = queryKeys.myItems.byUser(getSessionUserId());
  client.setQueryData(inventoryKey, []);
  drawApi.mockImplementation(async () => {
    fetchState.mockResolvedValue(claimed);
    return { results: [reward] };
  });
  const { result } = await renderHook(() => useStarterGacha(true), {
    wrapper: queryWrapper(client),
  });
  await waitFor(() => expect(result.current.state?.state).toBe('PENDING'));
  await act(async () => expect(await result.current.draw()).toEqual([reward]));
  await waitFor(() => expect(result.current.state?.state).toBe('CLAIMED'));
  expect(client.getQueryState(inventoryKey)?.isInvalidated).toBe(true);
  await act(async () => expect(await result.current.draw()).toEqual([reward]));
  expect(drawApi).toHaveBeenCalledTimes(1);
});

it('blocks simultaneous taps while the dedicated draw request is pending', async () => {
  let resolve!: (value: GachaDrawResponse) => void;
  drawApi.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result } = await renderHook(() => useStarterGacha(true), { wrapper: queryWrapper() });
  await waitFor(() => expect(result.current.state?.state).toBe('PENDING'));
  let first!: Promise<DrawResult[] | null>;
  await act(async () => {
    first = result.current.draw();
    expect(await result.current.draw()).toBeNull();
  });
  expect(drawApi).toHaveBeenCalledTimes(1);
  fetchState.mockResolvedValue(claimed);
  await act(async () => {
    resolve({ results: [reward] });
    await first;
  });
});

it('recovers a committed grant after losing the POST response instead of requesting another grant', async () => {
  drawApi.mockImplementation(async () => {
    fetchState.mockResolvedValue(claimed);
    throw new Error('connection lost');
  });
  const { result } = await renderHook(() => useStarterGacha(true), { wrapper: queryWrapper() });
  await waitFor(() => expect(result.current.state?.state).toBe('PENDING'));
  await act(async () => expect(await result.current.draw()).toEqual([reward]));
  expect(drawApi).toHaveBeenCalledTimes(1);
});

it('never POSTs for an already completed member', async () => {
  fetchState.mockResolvedValue({ state: 'CLOSED', reward: null });
  const { result } = await renderHook(() => useStarterGacha(true), { wrapper: queryWrapper() });
  await waitFor(() => expect(result.current.state?.state).toBe('CLOSED'));
  await act(async () => expect(await result.current.draw()).toBeNull());
  expect(drawApi).not.toHaveBeenCalled();
});

it('does not fetch or draw when onboarding is a replay', async () => {
  const { result } = await renderHook(() => useStarterGacha(false), { wrapper: queryWrapper() });
  await act(async () => expect(await result.current.draw()).toBeNull());
  expect(fetchState).not.toHaveBeenCalled();
  expect(drawApi).not.toHaveBeenCalled();
});

it('fails closed when eligibility cannot be loaded', async () => {
  fetchState.mockRejectedValue(new Error('offline'));
  const { result } = await renderHook(() => useStarterGacha(true), { wrapper: queryWrapper() });
  await waitFor(() => expect(result.current.error).toBe(true));
  await act(async () => expect(await result.current.draw()).toBeNull());
  expect(drawApi).not.toHaveBeenCalled();
});
