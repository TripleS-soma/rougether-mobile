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
    handleNotification: async (notification) =>
      suppressedNow(pushDataOf(notification.request))
        ? {
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }
        : {
            // 포그라운드 배너는 **앱이 전담해 그린다** (#902, ui/notification-banner).
            // 여기를 true로 두면 같은 알림이 시스템 배너와 인앱 배너로 두 번 뜬다.
            shouldShowBanner: false,
            // 트레이(알림 목록)에는 그대로 남는다 — 못 보고 지나쳐도 되찾을 수 있어야 한다.
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          },
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
  /** 집 채팅 새 메시지(CHAT_MESSAGE, 서버 #435) — 어느 집·방인지. 알림함에는 안 쌓이는 푸시 전용. */
  houseId?: number;
  roomId?: number;
};

/** 문자열(spec)·숫자 id → 양의 정수, 아니면 undefined. */
function idFrom(raw: unknown): number | undefined {
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** FCM data → 탭 정보. 값은 문자열로 온다(spec) — 숫자로 못 바꾸면 버린다. */
export function pushTapFrom(data: Record<string, unknown> | undefined): PushTap {
  const type = data?.type;
  return {
    type: typeof type === 'string' ? type : undefined,
    refId: idFrom(data?.postId ?? data?.refId),
    houseId: idFrom(data?.houseId),
    roomId: idFrom(data?.roomId),
  };
}

/**
 * 지금 화면이 이미 보여 주는 내용의 푸시를 거르는 필터 — 채팅방을 보는 중에 그 방 새 메시지가
 * 배너·소리·알림 목록으로 또 뜨지 않게(서버 #435는 소켓 구독 중이면 안 보내지만, 연결이 잠깐
 * 끊긴 사이에 온 것까지). 화면이 마운트될 때 등록하고 언마운트 때 null로 푼다.
 */
let foregroundFilter: ((tap: PushTap) => boolean) | null = null;
export function setForegroundPushFilter(filter: ((tap: PushTap) => boolean) | null): void {
  foregroundFilter = filter;
}
function suppressedNow(data: Record<string, unknown> | undefined): boolean {
  return foregroundFilter?.(pushTapFrom(data)) ?? false;
}

/**
 * 푸시의 data (#1582). Android는 `content.data`에 FCM data가 그대로 온다. **iOS는 원격 푸시의
 * `content.data`를 `userInfo["body"]`(Expo 푸시 서비스 형식)에서만 읽어서**(expo-notifications
 * `NotificationRecords.swift`), 서버가 FCM으로 보낸 `type`·`houseId`·`postId`(APNs `userInfo`
 * 최상위)는 거기 없다 — 탭해도 목적지를 몰라 알림함으로 갔다. 원본은 푸시 트리거의 `payload`에 있다.
 */
export function pushDataOf(
  request: Pick<Notifications.NotificationRequest, 'content' | 'trigger'>,
): Record<string, unknown> | undefined {
  const data = request.content.data as Record<string, unknown> | null | undefined;
  if (data && Object.keys(data).length > 0) return data;
  const trigger = request.trigger as { type?: string; payload?: unknown } | null;
  if (trigger?.type !== 'push' || !trigger.payload || typeof trigger.payload !== 'object') {
    return data ?? undefined;
  }
  return trigger.payload as Record<string, unknown>;
}

/**
 * 서버가 집 채팅 푸시에 붙이는 묶음 키 (서버 #526) — FCM data의 `groupKey`, Android 알림 tag,
 * APNs thread-id가 모두 이 값이다. 같은 집의 알림이 한 묶음으로 보이게 하는 단위.
 */
export function chatPushGroupKey(houseId: number): string {
  return `chat-house-${houseId}`;
}

/**
 * Android에서 앱이 꺼져 있을 때 FCM SDK가 직접 띄운 알림은 expo-notifications가 만든 게 아니라
 * data가 없다 — 식별자만 `expo-notifications://foreign_notifications?tag=<tag>&id=<id>` 꼴로 온다
 * (`ExpoPresentationDelegate.getInternalIdentifierKey`). 그 tag가 묶음 키인지 본다.
 */
function hasForeignTag(identifier: string, tag: string): boolean {
  if (!identifier.startsWith('expo-notifications://foreign_notifications')) return false;
  const query = identifier.split('?')[1] ?? '';
  return query.split('&').some((pair) => pair === `tag=${encodeURIComponent(tag)}`);
}

/**
 * 트레이에 남은 그 집 채팅 알림을 모두 지운다 (#1746). 알림 하나를 눌러 채팅에 들어오면 OS는
 * 누른 것만 지워서, 같은 집의 나머지가 읽은 뒤에도 남았다. 채팅 화면이 열릴 때 부른다 —
 * 알림을 눌렀든 앱 안에서 들어왔든 같다. 실패는 삼킨다(지우지 못해도 채팅은 열려야 한다).
 *
 * 그 집 알림인지는 두 가지로 본다: data(`type`·`houseId` — iOS, 그리고 앱이 켜진 채 받아
 * expo-notifications가 띄운 Android 알림)와 FCM SDK가 띄운 Android 알림의 tag.
 */
export async function dismissChatPushes(houseId: number): Promise<void> {
  if (!supportsPushNotifications()) return;
  const groupKey = chatPushGroupKey(houseId);
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const mine = presented.filter(({ request }) => {
      const tap = pushTapFrom(pushDataOf(request));
      if (tap.type === 'CHAT_MESSAGE' && tap.houseId === houseId) return true;
      return hasForeignTag(request.identifier, groupKey);
    });
    await Promise.all(
      mine.map(({ request }) =>
        Notifications.dismissNotificationAsync(request.identifier).catch(() => {}),
      ),
    );
  } catch {
    // 권한이 없거나 OS가 목록을 못 주는 경우 — 지울 게 없는 것과 같다.
  }
}

export function onNotificationTap(cb: (notification?: PushTap) => void): () => void {
  if (!supportsPushNotifications()) return () => {};
  let alive = true;
  let lastId: string | undefined;
  const receive = (response: Notifications.NotificationResponse) => {
    const { request } = response.notification;
    if (!alive || request.identifier === lastId) return;
    lastId = request.identifier;
    cb(pushTapFrom(pushDataOf(request)));
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
    // 지금 보고 있는 화면의 내용(그 채팅방 새 메시지)이면 인앱 배너도 띄우지 않는다.
    const data = pushDataOf(event.request);
    if (suppressedNow(data)) return;
    cb({ ...pushTapFrom(data), title, body });
  });
  return () => sub.remove();
}
