/**
 * 등록이 조용히 실패하면 사용자도 개발자도 모른다 (#903). syncPushToken은
 * 여전히 던지지 않지만, **어디서 끝났는지는 남겨야** "푸시가 안 와요"를
 * 서버·APNs·토큰·권한으로 가를 수 있다.
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { getPushDiagnostic, syncPushToken } from '@/lib/push-token';

// iOS 분기는 RNFirebase로 FCM 토큰을 받는다 — 저장소에 목이 없어 여기서 만든다.
let mockFcmToken: string | (() => never) = 'fcm-abcdefghijklmnop';
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
  registerDeviceForRemoteMessages: async () => {},
  getToken: async () => {
    const v = mockFcmToken;
    if (typeof v === 'function') return v();
    return v;
  },
  onTokenRefresh: () => () => {},
}));

jest.mock('@/api/device-tokens', () => ({
  registerDeviceToken: jest.fn(async () => ({})),
  unregisterDeviceToken: jest.fn(async () => ({})),
}));

const { registerDeviceToken } = jest.requireMock('@/api/device-tokens') as {
  registerDeviceToken: jest.Mock;
};

describe('syncPushToken 진단 (#903)', () => {
  // expo-device 목은 평범한 속성이라(getter가 아니다) 값을 직접 바꾼다.
  const device = Device as unknown as { isDevice: boolean };
  const getPerms = jest.spyOn(Notifications, 'getPermissionsAsync');
  const getToken = jest.spyOn(Notifications, 'getDevicePushTokenAsync');

  beforeEach(() => {
    jest.clearAllMocks();
    device.isDevice = true;
    getPerms.mockResolvedValue({ status: 'granted' } as never);
    getToken.mockResolvedValue({ data: 'fcm-abcdefghijklmnop' } as never);
    mockFcmToken = 'fcm-abcdefghijklmnop';
    registerDeviceToken.mockResolvedValue({});
  });

  it('끝까지 성공하면 registered + 토큰 앞자리만 남긴다', async () => {
    await syncPushToken();
    const d = getPushDiagnostic();
    expect(d.step).toBe('registered');
    // 토큰 전체는 자격증명이라 남기지 않는다.
    expect(d.tokenPrefix).toBe('fcm-abcdefgh');
    expect(JSON.stringify(d)).not.toContain('ijklmnop');
  });

  it('시뮬레이터는 no-device로 끝난다', async () => {
    device.isDevice = false;
    expect(await syncPushToken()).toBeNull();
    expect(getPushDiagnostic().step).toBe('no-device');
  });

  it('권한을 거부하면 permission-denied — 아래 단계는 무의미하다', async () => {
    getPerms.mockResolvedValue({ status: 'denied' } as never);
    jest.spyOn(Notifications, 'requestPermissionsAsync').mockResolvedValue({
      status: 'denied',
    } as never);
    expect(await syncPushToken()).toBeNull();
    expect(getPushDiagnostic().step).toBe('permission-denied');
    expect(registerDeviceToken).not.toHaveBeenCalled();
  });

  it('토큰 발급 실패와 서버 등록 실패를 구분한다 — 원인이 다르다', async () => {
    getToken.mockRejectedValue(new Error('no firebase app'));
    mockFcmToken = () => {
      throw new Error('no firebase app');
    };
    await syncPushToken();
    expect(getPushDiagnostic()).toMatchObject({
      step: 'token-failed',
      error: 'no firebase app',
    });

    getToken.mockResolvedValue({ data: 'fcm-abcdefghijklmnop' } as never);
    mockFcmToken = 'fcm-abcdefghijklmnop';
    registerDeviceToken.mockRejectedValue(new Error('500'));
    await syncPushToken();
    expect(getPushDiagnostic()).toMatchObject({
      step: 'register-failed',
      tokenPrefix: 'fcm-abcdefgh',
      error: '500',
    });
  });

  it('어떤 단계에서 끝나든 던지지 않는다 — 푸시가 로그인을 막으면 안 된다', async () => {
    getPerms.mockRejectedValue(new Error('boom'));
    jest.spyOn(Notifications, 'requestPermissionsAsync').mockRejectedValue(new Error('boom'));
    await expect(syncPushToken()).resolves.toBeNull();
  });
});
