/**
 * 알림 (server GET /notifications): cursor-paged newest-first list plus read
 * receipts. `load()` fetches the first page (also refreshing the unread badge
 * count); reads are optimistic — PATCH failures roll the row(s) back.
 */
import { useCallback, useRef, useState } from 'react';

import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/api';
import { toNotificationEntry } from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import type { NotificationEntry } from '@/components/screens/notification-list-screen';

export function useNotifications() {
  const [entries, setEntries] = useState<NotificationEntry[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  // 첫 페이지 로드 실패 (#549) — 화면이 빈 상태('알림 없음')와 구분해
  // 실패+다시 시도를 보여준다. 재시도 성공 시 해제.
  const [error, setError] = useState(false);
  const { show: toast } = useToast();
  const cursorRef = useRef<number | undefined>(undefined);

  const unreadCount = (entries ?? []).filter((n) => !n.read).length;

  /** (Re)load the first page. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const page = await fetchNotifications();
      cursorRef.current = page.nextCursor ?? undefined;
      setEntries((page.items ?? []).map(toNotificationEntry));
      setHasNext(!!page.hasNext);
    } catch {
      // Keep whatever was on screen; a fresh open shows the error state (#549).
      setEntries((prev) => prev ?? []);
      setHasNext(false);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (cursorRef.current == null) return;
    try {
      const page = await fetchNotifications(cursorRef.current);
      cursorRef.current = page.nextCursor ?? undefined;
      setEntries((prev) => [...(prev ?? []), ...(page.items ?? []).map(toNotificationEntry)]);
      setHasNext(!!page.hasNext);
    } catch {
      toast('알림을 더 불러오지 못했어요', 'error');
    }
  }, [toast]);

  /** Mark one read (optimistic; the server has no unread-undo). */
  const markRead = useCallback(
    async (id: number) => {
      setEntries((prev) => prev?.map((n) => (n.id === id ? { ...n, read: true } : n)));
      try {
        await markNotificationRead(id);
      } catch {
        setEntries((prev) => prev?.map((n) => (n.id === id ? { ...n, read: false } : n)));
        toast('읽음 처리에 실패했어요', 'error');
      }
    },
    [toast],
  );

  /** Mark everything read (optimistic). */
  const markAllRead = useCallback(async () => {
    const before = entries;
    setEntries((prev) => prev?.map((n) => (n.read ? n : { ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      setEntries(before);
      toast('읽음 처리에 실패했어요', 'error');
    }
  }, [entries, toast]);

  return { entries, unreadCount, loading, hasNext, error, load, loadMore, markRead, markAllRead };
}
