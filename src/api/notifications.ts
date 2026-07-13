/** Notification (알림) endpoints. */
import { apiGet, apiPatch } from './client';
import { buildQuery } from './http';
import type { NotificationListResponse } from './types';

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
