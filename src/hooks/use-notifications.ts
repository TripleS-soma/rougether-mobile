/**
 * 알림 (server GET /notifications): cursor-paged newest-first list plus read
 * receipts and deletion. `load()` fetches the first page (also refreshing the
 * unread badge count); reads and deletes are optimistic — failures roll the
 * row(s) back.
 */
import { useCallback, useRef, useState } from 'react';

import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api';
import { toNotificationEntry } from '@/api/adapters';
import { ApiError } from '@/api/http';
import { useToast } from '@/components/ui/toast';
import type { NotificationEntry } from '@/components/screens/notification-list-screen';
import { useLatestRef } from '@/hooks/use-stable-value';

/** 서버 목록 순서(id 내림차순)를 지키며 되돌린 행을 다시 끼운다. */
function reinsert(list: NotificationEntry[], entry: NotificationEntry): NotificationEntry[] {
  if (list.some((n) => n.id === entry.id)) return list;
  return [...list, entry].sort((a, b) => b.id - a.id);
}

export function useNotifications() {
  const [entries, setEntries] = useState<NotificationEntry[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  // 첫 페이지 로드 실패 (#549) — 화면이 빈 상태('알림 없음')와 구분해
  // 실패+다시 시도를 보여준다. 재시도 성공 시 해제.
  const [error, setError] = useState(false);
  const { show: toast } = useToast();
  const cursorRef = useRef<number | undefined>(undefined);
  // 삭제 실패 시 되돌릴 원본 — 콜백 의존성에 entries를 넣지 않으려고 ref로 읽는다.
  const entriesRef = useLatestRef(entries);
  const hasNextRef = useLatestRef(hasNext);

  const unreadCount = (entries ?? []).filter((n) => !n.read).length;

  /** (Re)load the first page. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const page = await fetchNotifications();
      cursorRef.current = page.nextCursor ?? undefined;
      setEntries(page.items.map(toNotificationEntry));
      setHasNext(page.hasNext);
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
      setEntries((prev) => [...(prev ?? []), ...page.items.map(toNotificationEntry)]);
      setHasNext(page.hasNext);
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

  /**
   * 하나 삭제 (#1137) — 목록에서 먼저 빼고 서버에 보낸다. 실패하면 원래 자리로
   * 되돌린다. `NOTIFICATION_NOT_FOUND` 404는 이미 없는 알림(다른 기기에서 지움)이라
   * 성공과 같다. **코드 없는 404는 실패다** — 삭제 API가 배포되지 않은 서버는 라우트가
   * 없어 맨 404를 주는데, 이걸 성공으로 접으면 행이 사라졌다가 새로고침에 되살아난다.
   */
  const remove = useCallback(
    async (id: number) => {
      const entry = entriesRef.current?.find((n) => n.id === id);
      if (!entry) return;
      setEntries((prev) => prev?.filter((n) => n.id !== id));
      try {
        await deleteNotification(id);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404 && e.code === 'NOTIFICATION_NOT_FOUND')
          return;
        setEntries((prev) => (prev ? reinsert(prev, entry) : prev));
        toast('알림을 삭제하지 못했어요', 'error');
      }
    },
    [entriesRef, toast],
  );

  /** 전체 삭제 (#1137) — 비우고 더보기도 닫는다. 실패하면 목록·페이지 상태를 되돌린다. */
  const removeAll = useCallback(async () => {
    const before = entriesRef.current;
    const beforeHasNext = hasNextRef.current;
    const beforeCursor = cursorRef.current;
    setEntries([]);
    setHasNext(false);
    cursorRef.current = undefined;
    try {
      await deleteAllNotifications();
    } catch {
      setEntries(before);
      setHasNext(beforeHasNext);
      cursorRef.current = beforeCursor;
      toast('알림을 삭제하지 못했어요', 'error');
    }
  }, [entriesRef, hasNextRef, toast]);

  return {
    entries,
    unreadCount,
    loading,
    hasNext,
    error,
    load,
    loadMore,
    markRead,
    markAllRead,
    remove,
    removeAll,
  };
}
