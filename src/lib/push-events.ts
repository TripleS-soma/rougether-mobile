/**
 * Push display/interaction wiring (#405) — everything after a push arrives.
 * Token lifecycle stays in push-token.ts. Web no-ops throughout: expo-
 * notifications' remote-push surface is native-only.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Android channel FCM v1 payloads should target
 * (`android.notification.channel_id`) — also set as the plugin's
 * `defaultChannel` in app.json so channel-less payloads land here too.
 */
export const DEFAULT_CHANNEL_ID = 'default';

/**
 * Foreground presentation + the Android channel. Call once at app start
 * (root layout) — without a handler, pushes arriving while the app is open
 * show nothing at all.
 */
export function initPushDisplay(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: '알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

/**
 * Subscribe to notification taps. Fires for taps while running AND for the
 * tap that cold-started the app (the launch response predates any listener).
 * Returns the unsubscribe.
 */
export function onNotificationTap(cb: () => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(() => cb());
  void Notifications.getLastNotificationResponseAsync()
    .then((resp) => {
      if (resp) cb();
    })
    .catch(() => {});
  return () => sub.remove();
}
