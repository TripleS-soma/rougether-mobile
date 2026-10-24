/**
 * 피드 상세와 원댓글. 대댓글은 펼친 스레드에서만 별도 조회한다 (#1570).
 * 작성·삭제 후 서버에서 목록·상세·스레드를 다시 받아 삭제 안내와 개수를 맞춘다.
 * 응답 유실 재시도는 본문과 실제 답글 대상까지 같은 경우에만 UUID를 재사용한다.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { getSessionUserId } from '@/api/auth';
import {
  createFeedComment,
  deleteFeedComment,
  fetchFeedComments,
  fetchFeedPost,
  fetchFeedReplies,
} from '@/api/feed';
import { ApiError } from '@/api/http';
import type { FeedComment, FeedRepliesState } from '@/components/screens/feed/types';
import type { FeedCommentRequest } from '@/api/types';
import { FEED_MAX_COMMENT, FEED_PAGE_SIZE } from '@/constants/feed';
import {
  type FeedCommentPages,
  type FeedCursor,
  feedErrorMessage,
  findFeedPost,
  isFeedPostGone,
  newFeedClientId,
  removeFeedPost,
} from '@/hooks/feed-cache';
import { useFeedActions } from '@/hooks/use-feed';
import { useLatestRef } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';

const NO_COMMENTS: FeedComment[] = [];

const selectComments = (data: FeedCommentPages): FeedComment[] => {
  const seen = new Set<number>();
  const out: FeedComment[] = [];
  for (const page of data.pages) {
    for (const c of page.items) {
      if (seen.has(c.commentId)) continue;
      seen.add(c.commentId);
      out.push(c);
    }
  }
  return out;
};

export function useFeedPost(
  postId: number | null,
  { onError }: { onError?: (message: string) => void } = {},
) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const onErrorRef = useLatestRef(onError);
  const postKey = useMemo(() => queryKeys.feed.post(userId, postId), [userId, postId]);
  const commentsKey = useMemo(() => queryKeys.feed.comments(userId, postId), [userId, postId]);

  const postQuery = useQuery({
    queryKey: postKey,
    queryFn: () => fetchFeedPost(postId as number),
    enabled: postId != null,
    // 목록에서 눌러 들어오면 목록 사본을 먼저 그린다 — 상세 응답이 오면 교체.
    placeholderData: () => (postId != null ? findFeedPost(qc, userId, postId) : undefined),
    // 삭제된 글은 재시도해도 404 — 한 번에 삭제 안내로.
    retry: (count, err) => !isFeedPostGone(err) && count < 1,
  });

  const commentsQuery = useInfiniteQuery({
    queryKey: commentsKey,
    queryFn: ({ pageParam }) =>
      fetchFeedComments(postId as number, {
        cursor: pageParam,
        size: FEED_PAGE_SIZE,
        topLevelOnly: true,
      }),
    initialPageParam: undefined as FeedCursor,
    getNextPageParam: (last) =>
      last.hasNext && last.nextCursor != null ? last.nextCursor : undefined,
    select: selectComments,
    enabled: postId != null,
  });

  const { mutateAsync: createCommentAsync } = useMutation({
    mutationFn: ({ postId: pid, ...input }: FeedCommentRequest & { postId: number }) =>
      createFeedComment(pid, input),
  });
  const { mutateAsync: deleteCommentAsync } = useMutation({
    mutationFn: ({ postId: pid, commentId }: { postId: number; commentId: number }) =>
      deleteFeedComment(pid, commentId),
  });

  const refreshComments = useCallback(async () => {
    await Promise.all([
      // comments 접두는 펼친 대댓글 쿼리도 포함한다.
      qc.invalidateQueries({ queryKey: commentsKey }),
      qc.invalidateQueries({ queryKey: postKey, exact: true }),
      qc.invalidateQueries({ queryKey: queryKeys.feed.lists(userId) }),
    ]);
  }, [qc, commentsKey, postKey, userId]);

  const pendingComment = useRef<{
    postId: number;
    content: string;
    replyToCommentId: number | null;
    id: string;
  } | null>(null);
  const sendingRef = useRef(false);

  const addComment = useCallback(
    async (raw: string, replyToCommentId?: number): Promise<boolean> => {
      const content = raw.trim();
      if (postId == null || !content || content.length > FEED_MAX_COMMENT) return false;
      if (sendingRef.current) return false;
      const target = replyToCommentId ?? null;
      const pending = pendingComment.current;
      const clientCommentId =
        pending &&
        pending.postId === postId &&
        pending.content === content &&
        pending.replyToCommentId === target
          ? pending.id
          : newFeedClientId();
      pendingComment.current = { postId, content, replyToCommentId: target, id: clientCommentId };
      sendingRef.current = true;
      try {
        await createCommentAsync({
          postId,
          clientCommentId,
          content,
          ...(target != null ? { replyToCommentId: target } : {}),
        });
        pendingComment.current = null;
        await refreshComments();
        track('feed_comment');
        return true;
      } catch (err) {
        if (isFeedPostGone(err)) removeFeedPost(qc, userId, postId);
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          pendingComment.current = null;
          // 작성 중 삭제·차단된 답글 대상을 화면에서도 갱신한다.
          if (err.code === 'FEED_COMMENT_NOT_FOUND') await refreshComments();
        }
        onErrorRef.current?.(feedErrorMessage(err));
        return false;
      } finally {
        sendingRef.current = false;
      }
    },
    [postId, qc, userId, createCommentAsync, onErrorRef, refreshComments],
  );

  const deleteComment = useCallback(
    async (commentId: number): Promise<boolean> => {
      if (postId == null) return false;
      try {
        await deleteCommentAsync({ postId, commentId });
      } catch (err) {
        const gone = err instanceof ApiError && err.code === 'FEED_COMMENT_NOT_FOUND';
        if (!gone) {
          if (isFeedPostGone(err)) removeFeedPost(qc, userId, postId);
          onErrorRef.current?.(feedErrorMessage(err));
          return false;
        }
      }
      // 원댓글을 단순 제거하면 남의 대댓글도 사라진다. 서버의 tombstone을 받는다.
      await refreshComments();
      return true;
    },
    [postId, qc, userId, deleteCommentAsync, onErrorRef, refreshComments],
  );

  const busyRef = useLatestRef(commentsQuery.isFetching);
  const hasNextRef = useLatestRef(commentsQuery.hasNextPage);
  const fetchNextComments = commentsQuery.fetchNextPage;
  const loadMoreComments = useCallback(() => {
    if (busyRef.current || !hasNextRef.current) return;
    void fetchNextComments().catch(() => {});
  }, [busyRef, hasNextRef, fetchNextComments]);

  const retry = useCallback(() => void refreshComments(), [refreshComments]);

  const actions = useFeedActions({ onError });

  const post = postQuery.data ?? null;
  const notFound = isFeedPostGone(postQuery.error);
  const loading = postId != null && postQuery.isPending;
  const error = postQuery.isError && !notFound && !post;
  const comments = commentsQuery.data ?? NO_COMMENTS;
  const commentsLoading = postId != null && commentsQuery.isPending;
  const commentsError = commentsQuery.isError;
  const commentsRefreshing = commentsQuery.isRefetching && !commentsQuery.isFetchingNextPage;
  const hasMoreComments = commentsQuery.hasNextPage;

  return useMemo(
    () => ({
      post,
      loading,
      error,
      notFound,
      comments,
      commentsLoading,
      commentsError,
      commentsRefreshing,
      hasMoreComments,
      loadMoreComments,
      addComment,
      deleteComment,
      retry,
      ...actions,
    }),
    [
      post,
      loading,
      error,
      notFound,
      comments,
      commentsLoading,
      commentsError,
      commentsRefreshing,
      hasMoreComments,
      loadMoreComments,
      addComment,
      deleteComment,
      retry,
      actions,
    ],
  );
}

/** 원댓글을 펼친 동안만 마운트한다. 계정·게시물·원댓글별 캐시와 독립 cursor. */
export function useFeedReplies(postId: number, rootCommentId: number): FeedRepliesState {
  const userId = getSessionUserId();
  const query = useInfiniteQuery({
    queryKey: queryKeys.feed.replies(userId, postId, rootCommentId),
    queryFn: ({ pageParam }) =>
      fetchFeedReplies(postId, rootCommentId, {
        cursor: pageParam,
        size: FEED_PAGE_SIZE,
      }),
    initialPageParam: undefined as FeedCursor,
    getNextPageParam: (last) =>
      last.hasNext && last.nextCursor != null ? last.nextCursor : undefined,
    select: selectComments,
  });
  const { fetchNextPage, refetch } = query;
  const busyRef = useLatestRef(query.isFetching);
  const hasNextRef = useLatestRef(query.hasNextPage);
  const onLoadMore = useCallback(() => {
    if (!busyRef.current && hasNextRef.current) void fetchNextPage().catch(() => {});
  }, [busyRef, hasNextRef, fetchNextPage]);
  const onRetry = useCallback(() => void refetch(), [refetch]);
  const comments = query.data ?? NO_COMMENTS;
  const loading = query.isPending;
  const error = query.isError;
  const hasMore = query.hasNextPage;
  const loadingMore = query.isFetchingNextPage;
  return useMemo(
    () => ({ comments, loading, error, hasMore, loadingMore, onLoadMore, onRetry }),
    [comments, loading, error, hasMore, loadingMore, onLoadMore, onRetry],
  );
}
