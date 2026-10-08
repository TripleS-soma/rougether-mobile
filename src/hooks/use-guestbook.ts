/**
 * Guestbook (방명록) for the friend room being visited. Loads the first page
 * when a friend's room opens, exposes cursor-based 더보기 and a write action
 * that prepends the created note. Requires the room owner's userId and the
 * shared houseId (both APIs demand the house context).
 *
 * 서버 상태는 react-query (#1027, 리팩토링 장부 16번) — 방(주인+집)마다 커서 페이지를
 * 캐시한다. 호출 계약은 그대로 명령형(`load`)이라 쿼리는 자동으로 받지 않고(enabled:false)
 * `load`가 첫 페이지부터 다시 받는다 — 방에 들어갈 때마다 최신 방명록을 보여 주던 동작 유지.
 */
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { createGuestbook, fetchGuestbooks, getSessionUserId, type Page } from '@/api';
import { toGuestbookEntry } from '@/api/adapters';
import type { GuestbookItem } from '@/api/types';
import { useToast } from '@/components/ui/toast';
import type { GuestbookEntry } from '@/components/screens/friend-room-screen';
import { useLatestRef } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import { i18n } from '@/i18n';

type Room = { roomOwnerId: number; houseId: number };
type GuestbookPages = InfiniteData<Page<GuestbookItem>, number | undefined>;

function guestbookOptions(userId: number | null | undefined, room: Room | null) {
  return {
    queryKey: queryKeys.guestbook(userId, room?.roomOwnerId ?? null, room?.houseId ?? null),
    queryFn: ({ pageParam }: { pageParam: number | undefined }) =>
      fetchGuestbooks(room!.roomOwnerId, room!.houseId, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last: Page<GuestbookItem>) => last.nextCursor ?? undefined,
  };
}

export function useGuestbook() {
  const userId = getSessionUserId();
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  // 지금 보고 있는 방 — load()가 정하고 loadMore()/write()가 쓴다. null = 데모(화면 기본 목록).
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useLatestRef(room);

  const query = useInfiniteQuery({ ...guestbookOptions(userId, room), enabled: false });
  const { data, isError, isFetching, isFetchingNextPage, fetchNextPage } = query;

  const entries = useMemo<GuestbookEntry[] | undefined>(() => {
    if (!room) return undefined; // screen falls back to its demo list
    // 로드 실패를 '방명록 없음'으로 위장하지 않도록 토스트로 알리고 빈 목록 (#549).
    if (!data) return isError ? [] : undefined;
    return data.pages.flatMap((p) => p.items.map(toGuestbookEntry));
  }, [room, data, isError]);
  const loading = isFetching && !isFetchingNextPage;
  const lastPage = data?.pages[data.pages.length - 1];
  const hasNext = room != null && (lastPage?.hasNext ?? false);
  const canLoadMoreRef = useLatestRef(lastPage?.nextCursor != null);

  /** Open a friend's room: reset and load the first page (undefined ids → demo). */
  const load = useCallback(
    async (roomOwnerId?: number, houseId?: number) => {
      if (roomOwnerId == null || houseId == null) {
        setRoom(null);
        return;
      }
      const next = { roomOwnerId, houseId };
      setRoom(next);
      const options = guestbookOptions(userId, next);
      // 같은 방을 다시 열어도(재시도 포함) 둘째 페이지 이후를 들고 있지 않게 첫 페이지부터.
      await queryClient.resetQueries({ queryKey: options.queryKey, exact: true });
      try {
        await queryClient.fetchInfiniteQuery(options);
      } catch {
        toast(i18n.t('app.guestbook.loadFailed'), 'error');
      }
    },
    [queryClient, toast, userId],
  );

  const loadMore = useCallback(async () => {
    if (!roomRef.current || !canLoadMoreRef.current) return;
    const result = await fetchNextPage();
    if (result.isError) toast(i18n.t('app.guestbook.loadMoreFailed'), 'error');
  }, [roomRef, canLoadMoreRef, fetchNextPage, toast]);

  const { mutateAsync: create } = useMutation({
    mutationFn: ({ room: r, content }: { room: Room; content: string }) =>
      createGuestbook(r.roomOwnerId, r.houseId, content),
  });

  const write = useCallback(
    async (content: string) => {
      const r = roomRef.current;
      if (!r) return;
      try {
        const created = await create({ room: r, content });
        // The create response has no author nickname — it's my own note.
        const mine: GuestbookItem = {
          guestbookId: created.guestbookId,
          authorId: created.authorId,
          authorNickname: i18n.t('app.guestbook.me'),
          content: created.content,
          createdAt: created.createdAt,
        };
        queryClient.setQueryData<GuestbookPages>(guestbookOptions(userId, r).queryKey, (old) =>
          old?.pages.length
            ? {
                ...old,
                pages: [
                  { ...old.pages[0], items: [mine, ...old.pages[0].items] },
                  ...old.pages.slice(1),
                ],
              }
            : { pages: [{ items: [mine], hasNext: false }], pageParams: [undefined] },
        );
        toast(i18n.t('app.guestbook.posted'), 'success');
        track('guestbook_write');
      } catch {
        toast(i18n.t('app.guestbook.postFailed'), 'error');
      }
    },
    [roomRef, create, queryClient, userId, toast],
  );

  return { entries, loading, hasNext, load, loadMore, write };
}
