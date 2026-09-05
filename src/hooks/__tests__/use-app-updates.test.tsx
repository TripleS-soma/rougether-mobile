import { act, renderHook } from '@testing-library/react-native';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { useAppUpdates } from '@/hooks/use-app-updates';

jest.mock('expo-constants', () => ({ expoConfig: { version: '1.4.0' } }));
jest.mock('expo-updates', () => ({
  isEnabled: true,
  channel: 'preview',
  runtimeVersion: 'runtime-111',
  updateId: 'running-update',
  isEmbeddedLaunch: false,
  isEmergencyLaunch: false,
  useUpdates: jest.fn(),
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
  UpdateCheckResultNotAvailableReason: { UPDATE_PREVIOUSLY_FAILED: 'updatePreviouslyFailed' },
}));

const available: Updates.UpdateCheckResult = {
  isAvailable: true,
  isRollBackToEmbedded: false,
  reason: undefined,
  manifest: { id: 'new-update' } as Updates.Manifest,
};
const noUpdate: Updates.UpdateCheckResult = {
  isAvailable: false,
  isRollBackToEmbedded: false,
  manifest: undefined,
  reason: 'noUpdateAvailableOnServer' as Updates.UpdateCheckResultNotAvailableReason,
};
const fetched: Updates.UpdateFetchResult = {
  isNew: true,
  isRollBackToEmbedded: false,
  manifest: available.manifest,
};
function setNative(overrides: Partial<ReturnType<typeof Updates.useUpdates>> = {}) {
  jest.mocked(Updates.useUpdates).mockReturnValue({
    isUpdatePending: false,
    isUpdateAvailable: false,
    isChecking: false,
    isDownloading: false,
    isRestarting: false,
    downloadProgress: 0,
    ...overrides,
  } as ReturnType<typeof Updates.useUpdates>);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
  Object.assign(globalThis, { __DEV__: false });
  Object.assign(Updates, { isEnabled: true });
  setNative();
  jest.mocked(Updates.checkForUpdateAsync).mockResolvedValue(available);
  jest.mocked(Updates.fetchUpdateAsync).mockResolvedValue(fetched);
  jest.mocked(Updates.reloadAsync).mockResolvedValue(undefined);
});
afterEach(() => {
  Object.assign(globalThis, { __DEV__: true });
  jest.restoreAllMocks();
});

it('checks, downloads, and waits for explicit apply without reloading', async () => {
  const { result } = await renderHook(() => useAppUpdates());
  expect(result.current.state.status).toBe('idle');
  expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.check();
  });
  expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
  expect(result.current.state.status).toBe('ready');
  expect(Updates.reloadAsync).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.apply();
  });
  expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  expect(result.current.state.status).toBe('applying');
  await act(async () => {
    await result.current.apply();
  });
  expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
});

it('serializes duplicate taps through checking and downloading', async () => {
  const check = deferred<Updates.UpdateCheckResult>();
  const download = deferred<Updates.UpdateFetchResult>();
  jest.mocked(Updates.checkForUpdateAsync).mockReturnValue(check.promise);
  jest.mocked(Updates.fetchUpdateAsync).mockReturnValue(download.promise);
  const { result } = await renderHook(() => useAppUpdates());
  let work!: Promise<void>;
  await act(() => {
    work = result.current.check();
    void result.current.check();
  });
  expect(result.current.state.status).toBe('checking');
  expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  await act(async () => {
    check.resolve(available);
  });
  expect(result.current.state.status).toBe('downloading');
  await act(async () => {
    await result.current.check();
    await result.current.apply();
  });
  expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  expect(Updates.reloadAsync).not.toHaveBeenCalled();
  await act(async () => {
    download.resolve(fetched);
    await work;
  });
  expect(result.current.state.status).toBe('ready');
});

it('makes a background-downloaded update available without another network check', async () => {
  const { result, rerender } = await renderHook(() => useAppUpdates());
  setNative({ isUpdatePending: true });
  await rerender({});
  expect(result.current.state.status).toBe('ready');
  await act(async () => {
    await result.current.check();
  });
  expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  expect(Updates.reloadAsync).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.apply();
  });
  expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
});

it.each(['isChecking', 'isDownloading', 'isRestarting'] as const)(
  'does not race native %s',
  async (flag) => {
    setNative({ [flag]: true, isUpdatePending: true });
    const { result } = await renderHook(() => useAppUpdates());
    await act(async () => {
      await result.current.check();
      await result.current.apply();
    });
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  },
);

it('does not reload when nothing has been downloaded', async () => {
  const { result } = await renderHook(() => useAppUpdates());
  await act(async () => {
    await result.current.apply();
  });
  expect(Updates.reloadAsync).not.toHaveBeenCalled();
});

it('distinguishes no compatible update from a download', async () => {
  jest.mocked(Updates.checkForUpdateAsync).mockResolvedValue(noUpdate);
  const { result } = await renderHook(() => useAppUpdates());
  await act(async () => {
    await result.current.check();
  });
  expect(result.current.state.status).toBe('no-update');
  expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
});

it('does not describe a previously failed update as the latest version', async () => {
  jest.mocked(Updates.checkForUpdateAsync).mockResolvedValue({
    ...noUpdate,
    reason: Updates.UpdateCheckResultNotAvailableReason.UPDATE_PREVIOUSLY_FAILED,
  });
  const { result } = await renderHook(() => useAppUpdates());
  await act(async () => {
    await result.current.check();
  });
  expect(result.current.state.status).toBe('error');
  expect(result.current.state.error).toContain('실행에 실패했던');
  expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
});

it.each(['checkForUpdateAsync', 'fetchUpdateAsync'] as const)(
  'recovers from %s errors on retry',
  async (method) => {
    const operation =
      method === 'checkForUpdateAsync' ? Updates.checkForUpdateAsync : Updates.fetchUpdateAsync;
    jest.mocked(operation).mockRejectedValueOnce(new Error('network failure'));
    const { result } = await renderHook(() => useAppUpdates());
    await act(async () => {
      await result.current.check();
    });
    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toContain('다시 시도');
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.check();
    });
    expect(result.current.state.status).toBe('ready');
    expect(result.current.state.error).toBeUndefined();
  },
);

it('does not call a failed download ready or up to date', async () => {
  jest
    .mocked(Updates.fetchUpdateAsync)
    .mockResolvedValue({ isNew: false, isRollBackToEmbedded: false, manifest: undefined });
  const { result } = await renderHook(() => useAppUpdates());
  await act(async () => {
    await result.current.check();
    await result.current.apply();
  });
  expect(result.current.state.status).toBe('error');
  expect(Updates.reloadAsync).not.toHaveBeenCalled();
});

it('keeps a downloaded update ready if reload fails', async () => {
  setNative({ isUpdatePending: true });
  jest.mocked(Updates.reloadAsync).mockRejectedValueOnce(new Error('reload failed'));
  const { result } = await renderHook(() => useAppUpdates());
  await act(async () => {
    await result.current.apply();
  });
  expect(result.current.state.status).toBe('ready');
  expect(result.current.state.error).toContain('적용하지 못했어요');
  await act(async () => {
    await result.current.apply();
  });
  expect(Updates.reloadAsync).toHaveBeenCalledTimes(2);
});

it('allows a server-directed rollback only through explicit apply', async () => {
  jest.mocked(Updates.checkForUpdateAsync).mockResolvedValue({
    isAvailable: false,
    isRollBackToEmbedded: true,
    manifest: undefined,
    reason: undefined,
  });
  jest
    .mocked(Updates.fetchUpdateAsync)
    .mockResolvedValue({ isNew: false, isRollBackToEmbedded: true, manifest: undefined });
  const { result } = await renderHook(() => useAppUpdates());
  await act(async () => {
    await result.current.check();
  });
  expect(result.current.state.status).toBe('ready');
  expect(Updates.reloadAsync).not.toHaveBeenCalled();
});

it.each(['web', 'development', 'disabled'])(
  'does not invoke native actions when %s',
  async (mode) => {
    if (mode === 'web') jest.replaceProperty(Platform, 'OS', 'web');
    if (mode === 'development') Object.assign(globalThis, { __DEV__: true });
    if (mode === 'disabled') Object.assign(Updates, { isEnabled: false });
    const { result } = await renderHook(() => useAppUpdates());
    expect(result.current.state.status).toBe('unsupported');
    await act(async () => {
      await result.current.check();
      await result.current.apply();
    });
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  },
);

it('does not start a download after the owner unmounts during a check', async () => {
  const check = deferred<Updates.UpdateCheckResult>();
  jest.mocked(Updates.checkForUpdateAsync).mockReturnValue(check.promise);
  const { result, unmount } = await renderHook(() => useAppUpdates());
  let work!: Promise<void>;
  await act(() => {
    work = result.current.check();
  });
  await unmount();
  await act(async () => {
    check.resolve(available);
    await work;
  });
  expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
});

it('keeps callbacks and state stable on unrelated renders and shows actual runtime identity', async () => {
  const { result, rerender } = await renderHook(() => useAppUpdates());
  const before = result.current;
  await rerender({});
  expect(result.current).toBe(before);
  expect(result.current.state).toBe(before.state);
  expect(result.current.check).toBe(before.check);
  expect(result.current.apply).toBe(before.apply);
  expect(result.current.state.info).toEqual({
    appVersion: '1.4.0',
    channel: 'preview',
    runtimeVersion: 'runtime-111',
    updateId: 'running-update',
    embedded: false,
    emergencyLaunch: false,
  });
});

it.each([
  [-0.2, 0],
  [1.2, 1],
  [0.42, 0.42],
  [NaN, undefined],
])('normalizes native progress %s', async (input, expected) => {
  setNative({ isDownloading: true, downloadProgress: input });
  const { result } = await renderHook(() => useAppUpdates());
  expect(result.current.state.progress).toBe(expected);
});
