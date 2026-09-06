import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

import type { AppIconResponse } from '@/api/app-icon';
import { setNativeAppIcon } from '@/lib/app-icon-native';
import {
  appIconRevision,
  applyAutomaticAppIcon,
  clearAutomaticAppIcon,
  invalidateAppIconWork,
} from '@/lib/app-icon-controller';

jest.mock('@/lib/app-icon-native', () => ({
  supportsAppIcons: () => true,
  setNativeAppIcon: jest.fn(async () => true),
}));
const response = { state: 'TEARY' } as AppIconResponse;
const originalPlatform = Platform.OS;
const originalState = AppState.currentState;
beforeEach(async () => {
  Platform.OS = 'android';
  AppState.currentState = 'background';
  await AsyncStorage.clear();
  jest.clearAllMocks();
  invalidateAppIconWork();
});
afterAll(() => {
  Platform.OS = originalPlatform;
  AppState.currentState = originalState;
});

it('automatically applies achievement state on iOS without a picker or stored preference', async () => {
  Platform.OS = 'ios';
  AppState.currentState = 'active';
  await applyAutomaticAppIcon(
    { ...response, state: 'DAILY_SUCCESS' },
    () => true,
    appIconRevision(),
  );
  expect(setNativeAppIcon).toHaveBeenCalledWith('DailySuccess');
  await clearAutomaticAppIcon();
  expect(setNativeAppIcon).toHaveBeenLastCalledWith(null);
});

it('does not attempt UIKit icon changes while iOS is in background', async () => {
  Platform.OS = 'ios';
  await applyAutomaticAppIcon(response, () => true, appIconRevision(), true);
  await applyAutomaticAppIcon(response, () => true, appIconRevision());
  expect(setNativeAppIcon).not.toHaveBeenCalled();
});

it('drops stale account or foreground work', async () => {
  const before = appIconRevision();
  invalidateAppIconWork();
  await applyAutomaticAppIcon(response, () => true, before);
  await applyAutomaticAppIcon(response, () => false, appIconRevision());
  expect(setNativeAppIcon).not.toHaveBeenCalled();
});

it('limits background changes to once per day but restores on foreground', async () => {
  await applyAutomaticAppIcon(response, () => true, appIconRevision(), true);
  await applyAutomaticAppIcon(
    { ...response, state: 'SOBBING' },
    () => true,
    appIconRevision(),
    true,
  );
  expect(setNativeAppIcon).toHaveBeenCalledTimes(1);
  AppState.currentState = 'active';
  await applyAutomaticAppIcon({ ...response, state: 'NORMAL' }, () => true, appIconRevision());
  expect(setNativeAppIcon).toHaveBeenLastCalledWith(null);
});

it('does not let a background response replace the returning user icon', async () => {
  AppState.currentState = 'active';
  await applyAutomaticAppIcon(response, () => true, appIconRevision(), true);
  expect(setNativeAppIcon).not.toHaveBeenCalled();
});

it('continues the serialized queue after an OS failure', async () => {
  jest.mocked(setNativeAppIcon).mockRejectedValueOnce(new Error('OS busy'));
  await expect(applyAutomaticAppIcon(response, () => true, appIconRevision())).rejects.toThrow(
    'OS busy',
  );
  await applyAutomaticAppIcon(response, () => true, appIconRevision());
  expect(setNativeAppIcon).toHaveBeenCalledTimes(2);
});
