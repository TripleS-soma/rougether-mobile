/**
 * 콘텐츠 신고·사용자 차단 (#1428) — react-query (AGENTS.md 서버 상태 규칙).
 *
 * 돌려주는 함수는 참조가 고정된다(#539) — `useMutation` 객체 대신 `mutateAsync`만 꺼내고,
 * 중복 탭 가드는 ref로 읽는다. 결과는 성공 여부(boolean)만 — 성공 안내(토스트)·화면 이동은
 * 호출부가, 실패 안내 문구는 여기서 만들어 `onError`로 넘긴다.
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { getSessionUserId } from '@/api/auth';
import { ApiError } from '@/api/http';
import {
  blockUser,
  fetchBlockedUsers,
  reportFeedComment,
  reportFeedPost,
  reportMarketAsset,
  unblockUser,
} from '@/api/moderation';
import type { BlockedUserResponse, ReportReason } from '@/api/types';
import type { BlockedUser } from '@/components/screens/blocked-users-screen';
import { BLOCKED_USERS_PAGE_SIZE } from '@/constants/moderation';
import { removeFeedAuthor } from '@/hooks/feed-cache';
import { useLatestRef } from '@/hooks/use-stable-value';
import { i18n } from '@/i18n';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';

export type ReportTarget =
  | { kind: 'post'; postId: number }
  | { kind: 'comment'; postId: number; commentId: number }
  | { kind: 'asset'; assetId: number };

type ErrorHandler = (message: string) => void;

function codeOf(err: unknown): string | undefined {
  return err instanceof ApiError ? err.code : undefined;
}

/** 신고 실패 → 안내 문구. 내 콘텐츠·사라진 대상은 따로, 나머지는 일반 문구. */
function reportErrorMessage(err: unknown): string {
  const code = codeOf(err);
  if (code === 'REPORT_SELF_TARGET') return i18n.t('member.moderation.toast.reportSelf');
  if (
    code === 'FEED_POST_NOT_FOUND' ||
    code === 'FEED_COMMENT_NOT_FOUND' ||
    code === 'MARKET_ASSET_NOT_FOUND'
  ) {
    return i18n.t('member.moderation.toast.reportGone');
  }
  return i18n.t('member.moderation.toast.reportFailed');
}

/** 차단·해제 실패 → 안내 문구. */
function blockErrorMessage(err: unknown, action: 'block' | 'unblock'): string {
  const code = codeOf(err);
  if (code === 'BLOCK_SELF') return i18n.t('member.moderation.toast.blockSelf');
  if (code === 'USER_NOT_FOUND') return i18n.t('member.moderation.toast.userGone');
  return i18n.t(
    action === 'block'
      ? 'member.moderation.toast.blockFailed'
      : 'member.moderation.toast.unblockFailed',
  );
}

function sendReport(target: ReportTarget, reason: ReportReason, detail?: string) {
  const input = { reason, detail };
  switch (target.kind) {
    case 'post':
      return reportFeedPost(target.postId, input);
    case 'comment':
      return reportFeedComment(target.postId, target.commentId, input);
    case 'asset':
      return reportMarketAsset(target.assetId, input);
  }
}

/**
 * 신고·차단·해제 동작. 차단·해제가 성공하면 피드(목록·상세·댓글)와 차단 목록을 새로 받는다 —
 * 차단은 그 전에 캐시에서 상대 글·댓글을 먼저 지워 새로고침 전에도 보이지 않게 한다.
 */
export function useModeration({ onError }: { onError?: ErrorHandler } = {}) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const onErrorRef = useLatestRef(onError);
  const userIdRef = useLatestRef(userId);
  const inflight = useRef(new Set<string>());

  const { mutateAsync: reportAsync } = useMutation({
    mutationFn: (v: { target: ReportTarget; reason: ReportReason; detail?: string }) =>
      sendReport(v.target, v.reason, v.detail),
  });
  const { mutateAsync: blockAsync } = useMutation({ mutationFn: (id: number) => blockUser(id) });
  const { mutateAsync: unblockAsync } = useMutation({
    mutationFn: (id: number) => unblockUser(id),
  });

  /** 한 번에 하나 — 같은 키의 중복 탭은 무시(false). */
  const guarded = useCallback(async (key: string, run: () => Promise<boolean>) => {
    if (inflight.current.has(key)) return false;
    inflight.current.add(key);
    try {
      return await run();
    } finally {
      inflight.current.delete(key);
    }
  }, []);

  const refreshAfterBlockChange = useCallback(() => {
    const uid = userIdRef.current;
    void qc.invalidateQueries({ queryKey: queryKeys.feed.all(uid) });
    void qc.invalidateQueries({ queryKey: queryKeys.blockedUsers(uid) });
  }, [qc, userIdRef]);

  const report = useCallback(
    (target: ReportTarget, reason: ReportReason, detail?: string) =>
      guarded(`report:${JSON.stringify(target)}`, async () => {
        try {
          await reportAsync({ target, reason, detail });
          track('content_report', { target: target.kind, reason });
          return true;
        } catch (err) {
          onErrorRef.current?.(reportErrorMessage(err));
          return false;
        }
      }),
    [guarded, reportAsync, onErrorRef],
  );

  const block = useCallback(
    (targetUserId: number, via?: 'post' | 'comment') =>
      guarded(`block:${targetUserId}`, async () => {
        try {
          await blockAsync(targetUserId);
          removeFeedAuthor(qc, userIdRef.current, targetUserId);
          refreshAfterBlockChange();
          track('user_block', via ? { via } : undefined);
          return true;
        } catch (err) {
          onErrorRef.current?.(blockErrorMessage(err, 'block'));
          return false;
        }
      }),
    [guarded, blockAsync, qc, userIdRef, refreshAfterBlockChange, onErrorRef],
  );

  const unblock = useCallback(
    (targetUserId: number) =>
      guarded(`unblock:${targetUserId}`, async () => {
        try {
          await unblockAsync(targetUserId);
          refreshAfterBlockChange();
          return true;
        } catch (err) {
          onErrorRef.current?.(blockErrorMessage(err, 'unblock'));
          return false;
        }
      }),
    [guarded, unblockAsync, refreshAfterBlockChange, onErrorRef],
  );

  return useMemo(() => ({ report, block, unblock }), [report, block, unblock]);
}

const NO_USERS: BlockedUser[] = [];

function toBlockedUser(res: BlockedUserResponse): BlockedUser | null {
  if (typeof res.userId !== 'number') return null;
  return {
    userId: res.userId,
    nickname: res.nickname ?? null,
    profileImageKey: res.profileImageKey ?? null,
    blockedAt: res.blockedAt ?? '',
  };
}

type BlockedPages = { pages: { items: BlockedUserResponse[] }[] };

const selectUsers = (data: BlockedPages): BlockedUser[] => {
  const seen = new Set<number>();
  const out: BlockedUser[] = [];
  for (const page of data.pages) {
    for (const raw of page.items) {
      const user = toBlockedUser(raw);
      if (!user || seen.has(user.userId)) continue;
      seen.add(user.userId);
      out.push(user);
    }
  }
  return out;
};

/** 내가 차단한 사용자 (GET /me/blocks) — 최근 차단순 cursor 무한 쿼리. `enabled`일 때만 받는다. */
export function useBlockedUsers({ enabled = true }: { enabled?: boolean } = {}) {
  const userId = getSessionUserId();
  const query = useInfiniteQuery({
    queryKey: queryKeys.blockedUsers(userId),
    queryFn: ({ pageParam }) =>
      fetchBlockedUsers({ cursor: pageParam, size: BLOCKED_USERS_PAGE_SIZE }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) =>
      last.hasNext && last.nextCursor != null ? last.nextCursor : undefined,
    select: selectUsers,
    enabled,
  });

  const { refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const hasNextRef = useLatestRef(hasNextPage && !isFetchingNextPage);
  const refresh = useCallback(() => void refetch(), [refetch]);
  const loadMore = useCallback(() => {
    if (hasNextRef.current) void fetchNextPage();
  }, [fetchNextPage, hasNextRef]);

  const users = query.data ?? NO_USERS;
  const loading = query.isPending && enabled;
  const error = query.isError && !query.data;
  return useMemo(
    () => ({
      users,
      loading,
      error,
      hasNext: !!hasNextPage,
      loadingMore: isFetchingNextPage,
      loadMore,
      refresh,
    }),
    [users, loading, error, hasNextPage, isFetchingNextPage, loadMore, refresh],
  );
}
