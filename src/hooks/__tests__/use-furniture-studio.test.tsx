import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  createFurniture,
  fetchFurnitureCredits,
  fetchFurnitureJobs,
} from '@/api/furniture-generation';
import { useFurnitureStudio } from '@/hooks/use-furniture-studio';
import { launchImageLibraryAsync } from 'expo-image-picker';

jest.mock('@/api/furniture-generation', () => ({
  createFurniture: jest.fn(),
  fetchFurnitureCredits: jest.fn(),
  fetchFurnitureJobs: jest.fn(),
  isFurnitureJobActive: (job: { status: string }) =>
    ['UPLOADING', 'QUEUED', 'PROCESSING'].includes(job.status),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
beforeEach(() => {
  (createFurniture as jest.Mock).mockReset();
  (fetchFurnitureCredits as jest.Mock).mockResolvedValue({ available: 1, reserved: 0 });
  (fetchFurnitureJobs as jest.Mock).mockResolvedValue([]);
  (launchImageLibraryAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///chair.jpg', mimeType: 'image/jpeg', fileSize: 100 }],
  });
});

it('keeps the request ID when a submission response is lost', async () => {
  (createFurniture as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
    id: 'one-job',
    status: 'QUEUED',
    assetKey: null,
    userItemId: null,
    failureCode: null,
  });
  const { result } = await renderHook(() => useFurnitureStudio());
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
  (createFurniture as jest.Mock).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const { result } = await renderHook(() => useFurnitureStudio());
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
  const { result } = await renderHook(() => useFurnitureStudio());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.choosePhoto();
    await result.current.submit();
  });
  expect(createFurniture).not.toHaveBeenCalled();
});

it('does not invent an empty balance when loading fails', async () => {
  (fetchFurnitureCredits as jest.Mock).mockRejectedValue(new Error('offline'));
  const { result } = await renderHook(() => useFurnitureStudio());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.balance).toBeNull();
  expect(result.current.error).toBeTruthy();
});
