import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  createFurniture,
  fetchFurnitureCredits,
  fetchFurnitureJobs,
} from '@/api/furniture-generation';
import { fetchWallets } from '@/api/me';
import { getSessionUserId } from '@/api/auth';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';
import { queryKeys } from '@/lib/query-keys';
import { useFurnitureStudio } from '@/hooks/use-furniture-studio';
import { launchImageLibraryAsync } from 'expo-image-picker';

jest.mock('@/api/furniture-generation', () => ({
  FURNITURE_GENERATION_COIN_COST: 100,
  createFurniture: jest.fn(),
  fetchFurnitureCredits: jest.fn(),
  fetchFurnitureJobs: jest.fn(),
  isFurnitureJobActive: (job: { status: string }) =>
    ['UPLOADING', 'QUEUED', 'PROCESSING'].includes(job.status),
}));
jest.mock('@/api/me', () => ({ fetchWallets: jest.fn() }));
jest.mock('@/api/auth', () => ({ getSessionUserId: jest.fn(() => 7) }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
let queryClient: ReturnType<typeof createTestQueryClient>;

beforeEach(() => {
  queryClient = createTestQueryClient();
  (fetchWallets as jest.Mock).mockResolvedValue([{ currencyType: 'COIN', balance: 0 }]);
  (createFurniture as jest.Mock).mockReset();
  (fetchFurnitureCredits as jest.Mock).mockResolvedValue({ available: 1, reserved: 0 });
  (fetchFurnitureJobs as jest.Mock).mockResolvedValue([]);
  (launchImageLibraryAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///chair.jpg', mimeType: 'image/jpeg', fileSize: 100 }],
  });
});

afterEach(() => queryClient.clear());

it('keeps the request ID when a submission response is lost', async () => {
  (createFurniture as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
    id: 'one-job',
    status: 'QUEUED',
    assetKey: null,
    userItemId: null,
    failureCode: null,
  });
  const { result } = await renderHook(() => useFurnitureStudio(), {
    wrapper: queryWrapper(queryClient),
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.choosePhoto();
  });
  await act(async () => {
    await result.current.submit();
  });
  expect(result.current.error).toBeTruthy();
  expect(result.current.photo).not.toBeNull();
  await act(async () => {
    await result.current.submit();
  });
  expect((createFurniture as jest.Mock).mock.calls[1][1]).toBe(
    (createFurniture as jest.Mock).mock.calls[0][1],
  );
  expect(result.current.photo).toBeNull();
});

it('blocks double taps before React re-renders', async () => {
  let resolve!: (value: unknown) => void;
  const response = new Promise((r) => {
    resolve = r;
  });
  (createFurniture as jest.Mock).mockReturnValue(response);
  const { result } = await renderHook(() => useFurnitureStudio(), {
    wrapper: queryWrapper(queryClient),
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.choosePhoto();
  });
  await act(async () => {
    const first = result.current.submit();
    await result.current.submit();
    resolve({
      id: 'one-job',
      status: 'QUEUED',
      assetKey: null,
      userItemId: null,
      failureCode: null,
    });
    await first;
  });
  expect(createFurniture).toHaveBeenCalledTimes(1);
});

it('restores a running job after reopening and refuses another submission', async () => {
  (fetchFurnitureJobs as jest.Mock).mockResolvedValue([{ id: 'old', status: 'PROCESSING' }]);
  const { result } = await renderHook(() => useFurnitureStudio(), {
    wrapper: queryWrapper(queryClient),
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.choosePhoto();
    await result.current.submit();
  });
  expect(createFurniture).not.toHaveBeenCalled();
});

it('does not invent an empty balance when loading fails', async () => {
  (fetchFurnitureCredits as jest.Mock).mockRejectedValue(new Error('offline'));
  const { result } = await renderHook(() => useFurnitureStudio(), {
    wrapper: queryWrapper(queryClient),
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.balance).toBeNull();
  expect(result.current.error).toBeTruthy();
});

it('submits without credits when the wallet has exactly 100 coins and refreshes shared wallet data', async () => {
  (fetchFurnitureCredits as jest.Mock).mockResolvedValue({ available: 0, reserved: 0 });
  (fetchWallets as jest.Mock).mockResolvedValue([{ currencyType: 'COIN', balance: 100 }]);
  (createFurniture as jest.Mock).mockImplementation(async () => {
    (fetchWallets as jest.Mock).mockResolvedValue([{ currencyType: 'COIN', balance: 0 }]);
    return {
      id: 'coin-job',
      status: 'QUEUED',
      assetKey: null,
      userItemId: null,
      failureCode: null,
    };
  });
  const client = queryClient;
  const { result } = await renderHook(() => useFurnitureStudio(), {
    wrapper: queryWrapper(client),
  });
  await waitFor(() => expect(result.current.coinBalance).toBe(100));
  await act(async () => {
    await result.current.choosePhoto();
  });
  await act(async () => {
    await result.current.submit();
  });
  expect(createFurniture).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(result.current.coinBalance).toBe(0));
  expect(client.getQueryData(queryKeys.wallet(getSessionUserId()))).toEqual({
    coin: 0,
    diamond: 0,
  });
});

it('refuses submission when both credits and 100 coins are unavailable', async () => {
  (fetchFurnitureCredits as jest.Mock).mockResolvedValue({ available: 0, reserved: 0 });
  (fetchWallets as jest.Mock).mockResolvedValue([{ currencyType: 'COIN', balance: 99 }]);
  const { result } = await renderHook(() => useFurnitureStudio(), {
    wrapper: queryWrapper(queryClient),
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.choosePhoto();
  });
  await act(async () => {
    await result.current.submit();
  });
  expect(createFurniture).not.toHaveBeenCalled();
});

it('allows credit-funded submission with no coins', async () => {
  (createFurniture as jest.Mock).mockResolvedValue({ id: 'credit-job', status: 'QUEUED' });
  const { result } = await renderHook(() => useFurnitureStudio(), {
    wrapper: queryWrapper(queryClient),
  });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.choosePhoto();
  });
  await act(async () => {
    await result.current.submit();
  });
  expect(createFurniture).toHaveBeenCalledTimes(1);
});
