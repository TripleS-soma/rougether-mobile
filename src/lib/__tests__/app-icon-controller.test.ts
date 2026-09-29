import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

import type { AppIconResponse } from '@/api/app-icon';
import { setNativeAppIcon } from '@/lib/app-icon-native';
import {
  appIconRevision,
  applyAutomaticAppIcon,
  clearAutomaticAppIcon,
  flushDeferredAppIcon,
  hasDeferredAppIcon,
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
  AppState.currentState = 'background';
  await flushDeferredAppIcon();
  expect(setNativeAppIcon).toHaveBeenLastCalledWith(null);
});

it('Android: 앱이 떠 있는 동안에는 바꾸지 않고, 화면을 떠날 때 마지막 결정만 적용한다', async () => {
  AppState.currentState = 'active';
  await applyAutomaticAppIcon(response, () => true, appIconRevision());
  await applyAutomaticAppIcon(
    { ...response, state: 'DAILY_SUCCESS' },
    () => true,
    appIconRevision(),
  );
  expect(setNativeAppIcon).not.toHaveBeenCalled();
  expect(hasDeferredAppIcon()).toBe(true);

  // 아직 화면에 있으면 계속 미룬다.
  await flushDeferredAppIcon();
  expect(setNativeAppIcon).not.toHaveBeenCalled();

  AppState.currentState = 'background';
  await flushDeferredAppIcon();
  expect(setNativeAppIcon).toHaveBeenCalledTimes(1);
  expect(setNativeAppIcon).toHaveBeenLastCalledWith('DailySuccess');
  expect(hasDeferredAppIcon()).toBe(false);
});

it('Android: 로그아웃 초기화도 화면을 떠날 때 적용한다', async () => {
  AppState.currentState = 'active';
  await clearAutomaticAppIcon();
  expect(setNativeAppIcon).not.toHaveBeenCalled();
  AppState.currentState = 'background';
  await flushDeferredAppIcon();
  expect(setNativeAppIcon).toHaveBeenLastCalledWith(null);
});

it('does not let a background response replace the returning user icon', async () => {
  AppState.currentState = 'active';
  await applyAutomaticAppIcon(response, () => true, appIconRevision(), true);
  expect(setNativeAppIcon).not.toHaveBeenCalled();
});

it('continues the serialized queue after an OS failure', async () => {
  Platform.OS = 'ios';
  AppState.currentState = 'active';
  jest.mocked(setNativeAppIcon).mockRejectedValueOnce(new Error('OS busy'));
  await expect(applyAutomaticAppIcon(response, () => true, appIconRevision())).rejects.toThrow(
    'OS busy',
  );
  await applyAutomaticAppIcon(response, () => true, appIconRevision());
  expect(setNativeAppIcon).toHaveBeenCalledTimes(2);
});
