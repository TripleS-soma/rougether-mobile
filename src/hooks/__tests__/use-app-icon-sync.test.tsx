import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { fetchAppIcon, recordAppActivity, type AppIconResponse } from '@/api/app-icon';
import { useAppIconSync } from '@/hooks/use-app-icon-sync';
import { notifyAppIconEvent } from '@/lib/app-icon-events';
import { applyAutomaticAppIcon, clearAutomaticAppIcon } from '@/lib/app-icon-controller';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

let mockStatus = 'authed';
let mockUserId = 1;
jest.mock('@/api/auth', () => ({ getSessionUserId: () => mockUserId }));
jest.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ status: mockStatus }) }));
jest.mock('@/api/app-icon', () => ({ fetchAppIcon: jest.fn(), recordAppActivity: jest.fn() }));
jest.mock('@/lib/app-icon-controller', () => ({
  appIconRevision: () => 0,
  invalidateAppIconWork: jest.fn(),
  applyAutomaticAppIcon: jest.fn(async () => {}),
  clearAutomaticAppIcon: jest.fn(async () => {}),
}));
const response: AppIconResponse = {
  state: 'NORMAL',
  message: '반갑다냥',
  evaluatedAt: '2026-09-06T00:00:00Z',
  lastForegroundAt: null,
  nextEvaluationAt: null,
  currentStreak: 0,
  completedToday: false,
};
let change: (() => void) | undefined;
const originalState = AppState.currentState;
let client: ReturnType<typeof createTestQueryClient>;
beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = 'authed';
  mockUserId = 1;
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    change = () => cb(AppState.currentState);
    return { remove: jest.fn() };
  });
  jest.mocked(recordAppActivity).mockResolvedValue(response);
  jest.mocked(fetchAppIcon).mockResolvedValue({ ...response, state: 'DAILY_SUCCESS' });
  client = createTestQueryClient();
});
afterEach(() => {
  client.clear();
  AppState.currentState = originalState;
  jest.restoreAllMocks();
});

it('records real foreground once, throttles touches and only GETs after completion', async () => {
  const hook = await renderHook(useAppIconSync, { wrapper: queryWrapper(client) });
  await waitFor(() => expect(applyAutomaticAppIcon).toHaveBeenCalledTimes(1));
  await act(async () => notifyAppIconEvent('foreground'));
  expect(recordAppActivity).toHaveBeenCalledTimes(1);
  await act(async () => notifyAppIconEvent('completion'));
  await waitFor(() => expect(fetchAppIcon).toHaveBeenCalledTimes(1));
  expect(recordAppActivity).toHaveBeenCalledTimes(1);
  await act(async () => {
    AppState.currentState = 'background';
    change?.();
    notifyAppIconEvent('completion');
  });
  expect(fetchAppIcon).toHaveBeenCalledTimes(1);
  await act(async () => {
    AppState.currentState = 'active';
    change?.();
  });
  await waitFor(() => expect(recordAppActivity).toHaveBeenCalledTimes(2));
  await hook.unmount();
});

it('waits for an in-flight activity before refreshing a newly completed routine', async () => {
  let finish!: (value: AppIconResponse) => void;
  jest.mocked(recordAppActivity).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const hook = await renderHook(useAppIconSync, { wrapper: queryWrapper(client) });
  await act(async () => notifyAppIconEvent('completion'));
  expect(fetchAppIcon).not.toHaveBeenCalled();
  await act(async () => finish(response));
  await waitFor(() => expect(fetchAppIcon).toHaveBeenCalledTimes(1));
  await hook.unmount();
});

it('does not apply a response from the account that just logged out', async () => {
  let finish!: (value: AppIconResponse) => void;
  jest.mocked(recordAppActivity).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const hook = await renderHook(useAppIconSync, { wrapper: queryWrapper(client) });
  mockStatus = 'guest';
  mockUserId = 2;
  await hook.rerender({});
  await act(async () => finish(response));
  expect(applyAutomaticAppIcon).not.toHaveBeenCalled();
  expect(clearAutomaticAppIcon).toHaveBeenCalled();
  await hook.unmount();
});

it('records another real return even if the previous foreground request is still pending', async () => {
  let finish!: (value: AppIconResponse) => void;
  jest.mocked(recordAppActivity).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const hook = await renderHook(useAppIconSync, { wrapper: queryWrapper(client) });
  await act(async () => {
    AppState.currentState = 'background';
    change?.();
    AppState.currentState = 'active';
    change?.();
  });
  await act(async () => finish(response));
  await waitFor(() => expect(recordAppActivity).toHaveBeenCalledTimes(2));
  await hook.unmount();
});
