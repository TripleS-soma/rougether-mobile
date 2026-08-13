/** Notification (알림) endpoints. */
import { apiGet, apiPatch } from './client';
import { buildQuery } from './http';
import type {
  NotificationListResponse,
  NotificationSettingResponse,
  NotificationSettingUpdateRequest,
} from './types';

/**
 * GET /notifications — my notifications, newest first (cursor-based infinite
 * scroll: first page without cursor, then pass the response's nextCursor).
 */
export function fetchNotifications(cursor?: number, size?: number) {
  return apiGet<NotificationListResponse>(`/notifications${buildQuery({ cursor, size })}`);
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
