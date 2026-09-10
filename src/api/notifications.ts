/** Notification (알림) endpoints. */
import { apiDelete, apiGet, apiGetPage, apiPatch } from './client';
import { buildQuery } from './http';
import type {
  NotificationItem,
  NotificationSettingResponse,
  NotificationSettingUpdateRequest,
} from './types';

/**
 * GET /notifications — my notifications, newest first (cursor-based infinite
 * scroll: first page without cursor, then pass the response's nextCursor).
 */
export function fetchNotifications(cursor?: number, size?: number) {
  return apiGetPage<NotificationItem>(`/notifications${buildQuery({ cursor, size })}`);
}

/** PATCH /notifications/read-all — mark every unread notification read. */
export function markAllNotificationsRead() {
  return apiPatch<void>('/notifications/read-all');
}

/** PATCH /notifications/{id}/read — mark one read (idempotent; no unread-undo). */
export function markNotificationRead(notificationId: number) {
  return apiPatch<void>(`/notifications/${notificationId}/read`);
}

/**
 * DELETE /notifications/{id} — 알림함에서 하나 삭제 (#1137, 서버 #375). soft delete라
 * 되돌릴 수 없고, 이미 지운 본인 알림에 다시 보내도 204(멱등). 미존재·타인 소유는
 * 404 `NOTIFICATION_NOT_FOUND` — 호출부가 "이미 없음"으로 접으므로 계측에서 뺀다.
 */
export function deleteNotification(notificationId: number) {
  return apiDelete<void>(`/notifications/${notificationId}`, undefined, {
    expectedStatuses: [404],
  });
}

/** DELETE /notifications — 알림함 전체 삭제 (#1137). 읽음 여부 무관, 비어 있어도 204. */
export function deleteAllNotifications() {
  return apiDelete<void>('/notifications');
}

/**
 * GET /users/me/notification-settings — push 설정 (#495). 한 번도 끈 적 없는
 * 항목은 true. 꺼도 알림함에는 쌓이고 push 발송만 중단된다.
 */
export function fetchNotificationSettings() {
  return apiGet<NotificationSettingResponse>('/users/me/notification-settings');
}

/**
 * PATCH /users/me/notification-settings — 부분 변경 (#495). 바꿀 항목만 보내면
 * 반영된 전체 설정이 돌아온다. all=false여도 그룹 값(reminder/house)은 서버가
 * 보존하므로, 마스터를 되켜면 이전 그룹 설정이 그대로 살아난다.
 */
export function updateNotificationSettings(patch: NotificationSettingUpdateRequest) {
  return apiPatch<NotificationSettingResponse>('/users/me/notification-settings', patch);
}
