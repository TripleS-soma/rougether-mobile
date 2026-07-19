/**
 * Push-token lifecycle (#250): after login, ask permission, fetch the native
 * device token (FCM on Android / APNs on iOS) and register it; on logout,
 * unregister. Every step soft-fails — push is never allowed to block auth
 * (simulators, web, denied permission, missing Firebase config all no-op).
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDeviceToken, unregisterDeviceToken } from '@/api/device-tokens';

let currentToken: string | null = null;

export async function syncPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    if (!Device.isDevice) return null;
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const { data } = await Notifications.getDevicePushTokenAsync();
    const token = typeof data === 'string' ? data : JSON.stringify(data);
    await registerDeviceToken(token, Platform.OS === 'ios' ? 'IOS' : 'ANDROID');
    currentToken = token;
    return token;
  } catch {
    return null;
  }
}

export async function clearPushToken(): Promise<void> {
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  try {
    await unregisterDeviceToken(token);
  } catch {
    // 서버 정리는 다음 로그인의 재등록으로도 수렴한다.
  }
}
