/**
 * Push display/interaction wiring (#405) — everything after a push arrives.
 * Token lifecycle stays in push-token.ts. Web no-ops throughout: expo-
 * notifications' remote-push surface is native-only.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { i18n } from '@/i18n';
import { supportsPushNotifications } from '@/config/features';

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
  if (!supportsPushNotifications()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // 포그라운드 배너는 **앱이 전담해 그린다** (#902, ui/notification-banner).
      // 여기를 true로 두면 같은 알림이 시스템 배너와 인앱 배너로 두 번 뜬다.
      shouldShowBanner: false,
      // 트레이(알림 목록)에는 그대로 남는다 — 못 보고 지나쳐도 되찾을 수 있어야 한다.
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: i18n.t('notification.push.channelName'),
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

/**
 * Subscribe to notification taps. Fires for taps while running AND for the
 * tap that cold-started the app (the launch response predates any listener).
 * Returns the unsubscribe.
 */
export type PushTap = {
  type?: string;
  /**
   * 목적지 리소스 id (#1409) — 피드 댓글 FCM data의 `postId`(spec notification api.md, 문자열 값).
   * 다른 알림은 data에 id를 싣지 않아 비어 있다(앞으로 `refId`를 실으면 그것도 읽는다).
   */
  refId?: number;
};

/** FCM data → 탭 정보. 값은 문자열로 온다(spec) — 숫자로 못 바꾸면 버린다. */
function pushTapFrom(data: Record<string, unknown> | undefined): PushTap {
  const type = data?.type;
  const raw = data?.postId ?? data?.refId;
  const refId = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  return {
    type: typeof type === 'string' ? type : undefined,
    refId: Number.isInteger(refId) && refId > 0 ? refId : undefined,
  };
}

export function onNotificationTap(cb: (notification?: PushTap) => void): () => void {
  if (!supportsPushNotifications()) return () => {};
  let alive = true;
  let lastId: string | undefined;
  const receive = (response: Notifications.NotificationResponse) => {
    const { identifier, content } = response.notification.request;
    if (!alive || identifier === lastId) return;
    lastId = identifier;
    cb(pushTapFrom(content.data as Record<string, unknown> | undefined));
  };
  const sub = Notifications.addNotificationResponseReceivedListener(receive);
  void Notifications.getLastNotificationResponseAsync()
    .then((resp) => {
      if (resp) receive(resp);
    })
    .catch(() => {});
  return () => {
    alive = false;
    sub.remove();
  };
}

/**
 * 앱이 켜져 있는 동안 도착한 알림 구독 (#902). RNFirebase `onMessage`가 아니라
 * expo-notifications를 쓰는 이유: 표시 규칙(`setNotificationHandler`)이 이미
 * 여기를 지나가고, 한 API로 iOS·Android가 함께 덮인다.
 *
 * 탭이 아니라 **수신** 시점이다 — 탭은 `onNotificationTap`이 따로 본다.
 * 반환값은 구독 해제.
 */
export function onNotificationReceived(
  cb: (n: PushTap & { title: string; body: string }) => void,
): () => void {
  if (!supportsPushNotifications()) return () => {};
  const sub = Notifications.addNotificationReceivedListener((event) => {
    const content = event.request.content;
    const title = content.title ?? '';
    const body = content.body ?? '';
    // 제목·본문이 모두 비면 그릴 게 없다 (data-only 메시지 등) — 조용히 넘긴다.
    if (!title && !body) return;
    cb({ ...pushTapFrom(content.data as Record<string, unknown> | undefined), title, body });
  });
  return () => sub.remove();
}
