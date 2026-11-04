import * as Notifications from 'expo-notifications';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import { Settings } from 'react-native-fbsdk-next';

import { requestAdTrackingOnce } from '@/lib/ad-tracking';

jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn() }));
jest.mock('expo-tracking-transparency', () => ({
  getTrackingPermissionsAsync: jest.fn(),
  requestTrackingPermissionsAsync: jest.fn(),
}));
jest.mock('react-native-fbsdk-next', () => ({
  Settings: { setAdvertiserTrackingEnabled: jest.fn(() => Promise.resolve(true)) },
}));
jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn() }));

const push = Notifications.getPermissionsAsync as jest.Mock;
const getAtt = getTrackingPermissionsAsync as jest.Mock;
const requestAtt = requestTrackingPermissionsAsync as jest.Mock;
const setAte = Settings.setAdvertiserTrackingEnabled as jest.Mock;

describe('requestAdTrackingOnce', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    push.mockResolvedValue({ status: 'granted' });
  });
  afterAll(() => Object.defineProperty(Platform, 'OS', { value: originalOS }));

  it('asks once and enables Meta tracking only when the user allows it', async () => {
    getAtt.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    requestAtt.mockResolvedValue({ status: 'granted' });
    await requestAdTrackingOnce();
    expect(requestAtt).toHaveBeenCalledTimes(1);
    expect(setAte).toHaveBeenCalledWith(true);
  });

  it('leaves tracking off when the user denies', async () => {
    getAtt.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    requestAtt.mockResolvedValue({ status: 'denied' });
    await requestAdTrackingOnce();
    expect(setAte).not.toHaveBeenCalled();
  });

  it('does not ask again once decided', async () => {
    getAtt.mockResolvedValue({ status: 'denied', canAskAgain: false });
    await requestAdTrackingOnce();
    expect(requestAtt).not.toHaveBeenCalled();
    expect(setAte).not.toHaveBeenCalled();
  });

  it('waits while the push prompt is still undecided', async () => {
    push.mockResolvedValue({ status: 'undetermined' });
    await requestAdTrackingOnce();
    expect(getAtt).not.toHaveBeenCalled();
  });

  it('never prompts on Android', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    await requestAdTrackingOnce();
    expect(push).not.toHaveBeenCalled();
    expect(requestAtt).not.toHaveBeenCalled();
  });
});
