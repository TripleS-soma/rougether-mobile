/**
 * FCM/APNs device push token registration (#250): the server stores tokens
 * per user for notification fan-out. Registered after login, removed on
 * logout. Spec: rougether-spec domains/notification.
 */
import { apiDelete, apiPost } from './client';

export type DevicePlatform = 'IOS' | 'ANDROID';

/** POST /users/me/device-tokens — register this device's push token. */
export function registerDeviceToken(token: string, platform: DevicePlatform) {
  return apiPost<unknown>('/users/me/device-tokens', { token, platform });
}

/** DELETE /users/me/device-tokens?token=… — unregister (로그아웃 시). */
export function unregisterDeviceToken(token: string) {
  return apiDelete<unknown>(`/users/me/device-tokens?token=${encodeURIComponent(token)}`);
}
