/**
 * Push-token lifecycle (#250, #405, #407): after login, ask permission, fetch
 * the platform token and register it; on logout, unregister. The server sends
 * everything through FCM (#407) — iOS therefore registers the FCM registration
 * token via RNFirebase (an APNs token cannot be addressed by FCM); Android's
 * expo-notifications native token is already an FCM token. Every step
 * soft-fails — push never blocks auth (simulators, web, denied permission,
 * missing Firebase config all no-op).
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDeviceToken, unregisterDeviceToken } from '@/api/device-tokens';

let currentToken: string | null = null;
let rotationUnsub: (() => void) | null = null;

const platform = () => (Platform.OS === 'ios' ? 'IOS' : 'ANDROID');

// RNFirebase는 네이티브 전용 — 지연 require로 웹 번들에서 평가되지 않게 한다.
const firebaseMessaging = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-firebase/messaging') as typeof import('@react-native-firebase/messaging');

async function fetchNativeToken(): Promise<string> {
  if (Platform.OS === 'ios') {
    const { getMessaging, getToken, registerDeviceForRemoteMessages } = firebaseMessaging();
    const messaging = getMessaging();
    await registerDeviceForRemoteMessages(messaging);
    return getToken(messaging);
  }
  const { data } = await Notifications.getDevicePushTokenAsync();
  return typeof data === 'string' ? data : JSON.stringify(data);
}

/**
 * FCM tokens rotate rarely but silently — without this, the device stops
 * receiving until the next explicit login. Watches only while a session holds
 * a registered token (cleared on logout).
 */
function watchTokenRotation(): void {
  if (rotationUnsub) return;
  const handleRotated = (token: string) => {
    if (token === currentToken) return;
    const previous = currentToken;
    currentToken = token;
    void registerDeviceToken(token, platform()).catch(() => {});
    if (previous) void unregisterDeviceToken(previous).catch(() => {});
  };
  if (Platform.OS === 'ios') {
    const { getMessaging, onTokenRefresh } = firebaseMessaging();
    rotationUnsub = onTokenRefresh(getMessaging(), handleRotated);
  } else {
    const sub = Notifications.addPushTokenListener(({ data }) =>
      handleRotated(typeof data === 'string' ? data : JSON.stringify(data)),
    );
    rotationUnsub = () => sub.remove();
  }
}

export async function syncPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    if (!Device.isDevice) return null;
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const token = await fetchNativeToken();
    await registerDeviceToken(token, platform());
    currentToken = token;
    watchTokenRotation();
    return token;
  } catch {
    return null;
  }
}

export async function clearPushToken(): Promise<void> {
  rotationUnsub?.();
  rotationUnsub = null;
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  try {
    await unregisterDeviceToken(token);
  } catch {
    // 서버 정리는 다음 로그인의 재등록으로도 수렴한다.
  }
}
