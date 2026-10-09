/**
 * 알림 (server GET /notifications): cursor-paged newest-first list plus read
 * receipts and deletion. `load()` fetches the first page (also refreshing the
 * unread badge count); reads and deletes are optimistic — failures roll the
 * row(s) back.
 *
 * 서버 상태는 react-query (#1027, 리팩토링 장부 16번) — 페이지를 화면 모델로 캐시하고
 * 낙관적 갱신·되돌리기는 `setQueryData`로 한다. 호출 계약은 명령형 그대로라 쿼리는
 * 스스로 받지 않고(enabled:false) `load()`가 첫 페이지만 다시 받는다.
 */
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  getSessionUserId,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api';
import { toNotificationEntry } from '@/api/adapters';
import { ApiError } from '@/api/http';
import { useToast } from '@/components/ui/toast';
import type { NotificationEntry } from '@/components/screens/notification-list-screen';
import { i18n } from '@/i18n';
import { queryKeys } from '@/lib/query-keys';

type NotificationPage = { items: NotificationEntry[]; hasNext: boolean; nextCursor?: number };
type NotificationPages = InfiniteData<NotificationPage, number | undefined>;

/** 서버 목록 순서(id 내림차순)를 지키며 되돌린 행을 다시 끼운다. */
function reinsert(list: NotificationEntry[], entry: NotificationEntry): NotificationEntry[] {
  if (list.some((n) => n.id === entry.id)) return list;
  return [...list, entry].sort((a, b) => b.id - a.id);
}

const EMPTY_PAGES: NotificationPages = {
  pages: [{ items: [], hasNext: false }],
  pageParams: [undefined],
};

function notificationOptions(userId: number | null | undefined) {
  return {
    queryKey: queryKeys.notifications(userId),
    queryFn: async ({ pageParam }: { pageParam: number | undefined }) => {
      const page = await fetchNotifications(pageParam);
      return {
        items: page.items.map(toNotificationEntry),
        hasNext: page.hasNext,
        nextCursor: page.nextCursor ?? undefined,
      } satisfies NotificationPage;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last: NotificationPage) => last.nextCursor,
  };
}

export function useNotifications() {
  const userId = getSessionUserId();
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const { data } = useInfiniteQuery({
    ...notificationOptions(userId),
    enabled: false,
  });

  const [loading, setLoading] = useState(false);
  // 첫 페이지 로드 실패 (#549) — 화면이 빈 상태('알림 없음')와 구분해
  // 실패+다시 시도를 보여준다. 재시도 성공 시 해제.
  const [error, setError] = useState(false);

  const entries = useMemo(
    () => (data ? data.pages.flatMap((p) => p.items) : error ? [] : undefined),
    [data, error],
  );
  const lastPage = data?.pages[data.pages.length - 1];
  const hasNext = !error && (lastPage?.hasNext ?? false);
  const unreadCount = (entries ?? []).filter((n) => !n.read).length;

  /** 페이지 구조를 지키며 행만 바꾼다. 아직 안 불러왔으면(undefined) 그대로. */
  const updateItems = useCallback(
    (fn: (items: NotificationEntry[], pageIndex: number) => NotificationEntry[]) =>
      queryClient.setQueryData<NotificationPages>(
        queryKeys.notifications(userId),
        (old) =>
          old && { ...old, pages: old.pages.map((p, i) => ({ ...p, items: fn(p.items, i) })) },
      ),
    [queryClient, userId],
  );
  /** 되돌리기용 스냅샷 — 렌더된 값이 아니라 캐시를 읽는다(방금 받은 페이지도 포함). */
  const snapshot = useCallback(
    () => queryClient.getQueryData<NotificationPages>(queryKeys.notifications(userId)),
    [queryClient, userId],
  );
  const restore = useCallback(
    (before: NotificationPages | undefined) => {
      const queryKey = queryKeys.notifications(userId);
      // 불러오기 전 상태로 되돌릴 땐 setQueryData(undefined)가 no-op이라 초기화한다.
      if (before) queryClient.setQueryData(queryKey, before);
      else void queryClient.resetQueries({ queryKey, exact: true });
    },
    [queryClient, userId],
  );

  /** (Re)load the first page. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // 첫 페이지만 — 더보기로 붙였던 페이지는 접는다.
      await queryClient.fetchInfiniteQuery({
        ...notificationOptions(userId),
        pages: 1,
        staleTime: 0,
      });
    } catch {
      // Keep whatever was on screen; a fresh open shows the error state (#549).
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [queryClient, userId]);

  /**
   * 다음 페이지를 받아 **함수형으로** 이어 붙인다. react-query의 fetchNextPage는 요청을
   * 시작한 시점의 페이지에 붙인 결과로 캐시를 덮어써서, 요청 중에 한 읽음·삭제가 되돌아간다.
   */
  const loadMore = useCallback(async () => {
    const cursor = snapshot()?.pages.at(-1)?.nextCursor;
    if (cursor == null) return;
    try {
      const page = await notificationOptions(userId).queryFn({ pageParam: cursor });
      queryClient.setQueryData<NotificationPages>(
        queryKeys.notifications(userId),
        (old) => old && { pages: [...old.pages, page], pageParams: [...old.pageParams, cursor] },
      );
    } catch {
      toast(i18n.t('notification.list.loadMoreFailed'), 'error');
    }
  }, [snapshot, queryClient, userId, toast]);

  /** Mark one read (optimistic; the server has no unread-undo). */
  const markRead = useCallback(
    async (id: number) => {
      updateItems((items) => items.map((n) => (n.id === id ? { ...n, read: true } : n)));
      try {
        await markNotificationRead(id);
      } catch {
        updateItems((items) => items.map((n) => (n.id === id ? { ...n, read: false } : n)));
        toast(i18n.t('notification.list.markReadFailed'), 'error');
      }
    },
    [updateItems, toast],
  );

  /** Mark everything read (optimistic). */
  const markAllRead = useCallback(async () => {
    const before = snapshot();
    updateItems((items) => items.map((n) => (n.read ? n : { ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      restore(before);
      toast(i18n.t('notification.list.markReadFailed'), 'error');
    }
  }, [snapshot, updateItems, restore, toast]);

  /**
   * 하나 삭제 (#1137) — 목록에서 먼저 빼고 서버에 보낸다. 실패하면 원래 자리로
   * 되돌린다. `NOTIFICATION_NOT_FOUND` 404는 이미 없는 알림(다른 기기에서 지움)이라
   * 성공과 같다. **코드 없는 404는 실패다** — 삭제 API가 배포되지 않은 서버는 라우트가
   * 없어 맨 404를 주는데, 이걸 성공으로 접으면 행이 사라졌다가 새로고침에 되살아난다.
   */
  const remove = useCallback(
    async (id: number) => {
      const pages = snapshot()?.pages ?? [];
      const pageIndex = pages.findIndex((p) => p.items.some((n) => n.id === id));
      if (pageIndex < 0) return;
      const entry = pages[pageIndex].items.find((n) => n.id === id)!;
      updateItems((items) => items.filter((n) => n.id !== id));
      try {
        await deleteNotification(id);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404 && e.code === 'NOTIFICATION_NOT_FOUND')
          return;
        updateItems((items, i) => (i === pageIndex ? reinsert(items, entry) : items));
        toast(i18n.t('notification.list.deleteFailed'), 'error');
      }
    },
    [snapshot, updateItems, toast],
  );

  /** 전체 삭제 (#1137) — 비우고 더보기도 닫는다. 실패하면 목록·페이지 상태를 되돌린다. */
  const removeAll = useCallback(async () => {
    const before = snapshot();
    restore(EMPTY_PAGES);
    try {
      await deleteAllNotifications();
    } catch {
      restore(before);
      toast(i18n.t('notification.list.deleteFailed'), 'error');
    }
  }, [snapshot, restore, toast]);

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
