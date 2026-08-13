/**
 * Guestbook (방명록) for the friend room being visited. Loads the first page
 * when a friend's room opens, exposes cursor-based 더보기 and a write action
 * that prepends the created note. Requires the room owner's userId and the
 * shared houseId (both APIs demand the house context).
 */
import { useCallback, useRef, useState } from 'react';

import { createGuestbook, fetchGuestbooks } from '@/api';
import { toGuestbookEntry } from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import type { GuestbookEntry } from '@/components/screens/friend-room-screen';
import { track } from '@/lib/analytics';

export function useGuestbook() {
  const [entries, setEntries] = useState<GuestbookEntry[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const { show: toast } = useToast();
  // Current room context; set by load(), used by loadMore()/write().
  const ctxRef = useRef<{ roomOwnerId: number; houseId: number; cursor?: number } | null>(null);

  /** Open a friend's room: reset and load the first page (undefined ids → demo). */
  const load = useCallback(
    async (roomOwnerId?: number, houseId?: number) => {
      if (roomOwnerId == null || houseId == null) {
        ctxRef.current = null;
        setEntries(undefined); // screen falls back to its demo list
        setHasNext(false);
        return;
      }
      ctxRef.current = { roomOwnerId, houseId };
      setEntries(undefined);
      setLoading(true);
      try {
        const page = await fetchGuestbooks(roomOwnerId, houseId);
        ctxRef.current.cursor = page.nextCursor ?? undefined;
        setEntries((page.items ?? []).map(toGuestbookEntry));
        setHasNext(!!page.hasNext);
      } catch {
        // 로드 실패를 '방명록 없음'으로 위장하지 않도록 정직하게 알린다 (#549).
        setEntries([]);
        setHasNext(false);
        toast('방명록을 불러오지 못했어요', 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const loadMore = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.cursor == null) return;
    try {
      const page = await fetchGuestbooks(ctx.roomOwnerId, ctx.houseId, ctx.cursor);
      ctx.cursor = page.nextCursor ?? undefined;
      setEntries((prev) => [...(prev ?? []), ...(page.items ?? []).map(toGuestbookEntry)]);
      setHasNext(!!page.hasNext);
    } catch {
      toast('방명록을 더 불러오지 못했어요', 'error');
    }
  }, [toast]);

  const write = useCallback(
    async (content: string) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      try {
        const created = await createGuestbook(ctx.roomOwnerId, ctx.houseId, content);
        // The create response has no author nickname — it's my own note.
        const entry = toGuestbookEntry({
          guestbookId: created.guestbookId,
          authorId: created.authorId,
          content: created.content,
          createdAt: created.createdAt,
        });
        setEntries((prev) => [{ ...entry, author: '나' }, ...(prev ?? [])]);
        toast('방명록을 남겼어요', 'success');
        track('guestbook_write');
      } catch {
        toast('방명록 작성에 실패했어요', 'error');
      }
    },
    [toast],
  );

  return { entries, loading, hasNext, load, loadMore, write };
}
