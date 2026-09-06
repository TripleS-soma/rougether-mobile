import { AppState, Platform } from 'react-native';
import { fetchAppIcon, recordAppActivity } from '@/api/app-icon';
import { refreshBackgroundAppIcon } from '@/lib/app-icon-background';
import { applyAutomaticAppIcon } from '@/lib/app-icon-controller';

jest.mock('expo-background-task', () => ({ BackgroundTaskResult: { Success: 1, Failed: 2 } }));
jest.mock('expo-task-manager', () => ({ isTaskDefined: () => false, defineTask: jest.fn() }));
jest.mock('@/api/auth', () => ({
  getAccessToken: () => 'token',
  getSessionUserId: () => 1,
  loadSession: jest.fn(),
}));
jest.mock('@/api/app-icon', () => ({
  fetchAppIcon: jest.fn(async () => ({ state: 'TEARY' })),
  recordAppActivity: jest.fn(),
}));
jest.mock('@/lib/app-icon-controller', () => ({
  appIconRevision: () => 2,
  applyAutomaticAppIcon: jest.fn(),
}));
const originalOS = Platform.OS;
const originalState = AppState.currentState;
afterEach(() => {
  Platform.OS = originalOS;
  AppState.currentState = originalState;
  jest.clearAllMocks();
});

it('headless Android refresh reads the state without recording a visit', async () => {
  Platform.OS = 'android';
  AppState.currentState = 'background';
  await refreshBackgroundAppIcon();
  expect(fetchAppIcon).toHaveBeenCalledTimes(1);
  expect(recordAppActivity).not.toHaveBeenCalled();
  expect(applyAutomaticAppIcon).toHaveBeenCalledWith(
    { state: 'TEARY' },
    expect.any(Function),
    2,
    true,
  );
});
it('does not run automatic work on iOS or in foreground', async () => {
  Platform.OS = 'ios';
  AppState.currentState = 'background';
  await refreshBackgroundAppIcon();
  Platform.OS = 'android';
  AppState.currentState = 'active';
  await refreshBackgroundAppIcon();
  expect(fetchAppIcon).not.toHaveBeenCalled();
  expect(recordAppActivity).not.toHaveBeenCalled();
});
