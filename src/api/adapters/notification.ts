/** Notification list adapters. */
import { i18n } from '@/i18n';
import { relativeTimeLabel } from '@/utils/datetime';
import type { NotificationEntry } from '@/components/screens/notification-list-screen';
import type { NotificationItem } from '@/api/types';

/** Notification → 알림 list row (상대 시간 "N분 전"; 7일 지나면 "M월 D일", #508). */
export function toNotificationEntry(n: NotificationItem): NotificationEntry {
  const d = n.createdAt ? new Date(n.createdAt) : null;
  return {
    id: n.notificationId ?? 0,
    type: n.type,
    title: n.title ?? i18n.t('notification.list.defaultTitle'),
    body: n.body ?? '',
    read: n.isRead === true,
    date: d ? relativeTimeLabel(d) : '',
  };
}
