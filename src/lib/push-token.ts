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

/**
 * 등록이 어디서 끝났는지 (#903).
 *
 * `syncPushToken`은 모든 단계를 soft-fail시킨다 — 푸시가 로그인을 막으면 안
 * 되기 때문이다. 대신 **조용히 실패하면 사용자도 개발자도 모른다.** "푸시가
 * 안 와요"를 받았을 때 서버·APNs·토큰·권한 중 어디가 끊겼는지 가릴 수
 * 있도록, 끝난 지점을 남긴다.
 */
export type PushRegistrationStep =
  /** 아직 시도 전 (로그인 전). */
  | 'idle'
  /** 웹 — 푸시 표면이 없다. */
  | 'unsupported'
  /** 시뮬레이터/에뮬레이터 — 실기기가 아니면 토큰이 없다. */
  | 'no-device'
  /** 사용자가 알림 권한을 거부했다. 여기서 막히면 아래는 다 무의미하다. */
  | 'permission-denied'
  /** FCM 토큰을 못 받았다 (Firebase 설정·APNs 등록 문제). */
  | 'token-failed'
  /** 서버 등록(POST /users/me/device-tokens)이 실패했다. */
  | 'register-failed'
  /** 여기까지 오면 앱 쪽 할 일은 끝 — 안 오면 서버·APNs 쪽이다. */
  | 'registered';

export type PushDiagnostic = {
  step: PushRegistrationStep;
  /** 토큰 앞자리만 — 전체는 자격증명이라 남기지 않는다. */
  tokenPrefix?: string;
  error?: string;
};

let diagnostic: PushDiagnostic = { step: 'idle' };

function record(step: PushRegistrationStep, extra: Omit<PushDiagnostic, 'step'> = {}): void {
  diagnostic = { step, ...extra };
  if (__DEV__) {
    // 개발 빌드에서만 — 실기기에서 로그로 바로 가릴 수 있게 (#903).
    console.log('[push]', step, extra.tokenPrefix ?? '', extra.error ?? '');
  }
}

/** 마지막 등록 시도가 어디서 끝났는지. 설정 화면이 상태 줄로 보여준다. */
export function getPushDiagnostic(): PushDiagnostic {
  return diagnostic;
}

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
  if (Platform.OS === 'web') {
    record('unsupported');
    return null;
  }
  if (!Device.isDevice) {
    record('no-device');
    return null;
  }
  let { status } = await Notifications.getPermissionsAsync().catch(() => ({ status: 'denied' }));
  if (status !== 'granted')
    status = (await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' })))
      .status;
  if (status !== 'granted') {
    record('permission-denied');
    return null;
  }
  // 토큰 발급과 서버 등록을 나눠 잡는다 — 둘은 원인이 완전히 다르다
  // (전자는 Firebase·APNs 설정, 후자는 서버·네트워크).
  let token: string;
  try {
    token = await fetchNativeToken();
  } catch (e) {
    record('token-failed', { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
  const tokenPrefix = token.slice(0, 12);
  try {
    await registerDeviceToken(token, platform());
  } catch (e) {
    record('register-failed', { tokenPrefix, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
  currentToken = token;
  watchTokenRotation();
  record('registered', { tokenPrefix });
  return token;
}

export async function clearPushToken(): Promise<void> {
  record('idle');
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
