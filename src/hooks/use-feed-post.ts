/**
 * 피드 게시물 상세 + 댓글 (#1409). 댓글은 **오래된 순**(`id > cursor`) 무한 쿼리라, 새 댓글은
 * 마지막 페이지까지 받은 경우에만 끝에 붙이고 그 전이면 더보기로 자연히 만난다.
 * 댓글 수는 목록·상세 캐시를 함께 고친다(`feed-cache`).
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { getSessionUserId } from '@/api/auth';
import { createFeedComment, deleteFeedComment, fetchFeedComments, fetchFeedPost } from '@/api/feed';
import { ApiError } from '@/api/http';
import type { FeedComment } from '@/components/screens/feed/types';
import { FEED_MAX_COMMENT, FEED_PAGE_SIZE } from '@/constants/feed';
import {
  type FeedCommentPages,
  type FeedCursor,
  feedErrorMessage,
  findFeedPost,
  isFeedPostGone,
  newFeedClientId,
  patchFeedPost,
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
      fetchFeedComments(postId as number, { cursor: pageParam, size: FEED_PAGE_SIZE }),
    initialPageParam: undefined as FeedCursor,
    getNextPageParam: (last) =>
      last.hasNext && last.nextCursor != null ? last.nextCursor : undefined,
    select: selectComments,
    enabled: postId != null,
  });

  const { mutateAsync: createCommentAsync } = useMutation({
    mutationFn: (input: { postId: number; clientCommentId: string; content: string }) =>
      createFeedComment(input.postId, {
        clientCommentId: input.clientCommentId,
        content: input.content,
      }),
  });
  const { mutateAsync: deleteCommentAsync } = useMutation({
    mutationFn: ({ postId: pid, commentId }: { postId: number; commentId: number }) =>
      deleteFeedComment(pid, commentId),
  });

  // 실패한 댓글의 재시도는 같은 clientCommentId로 — 응답을 잃은 등록이 두 번 달리지 않게.
  // 본문을 고쳐 다시 보내면 새 id(같은 id·다른 본문은 서버가 409).
  const pendingComment = useRef<{ postId: number; content: string; id: string } | null>(null);
  const sendingRef = useRef(false);

  /** 댓글 달기 — 앞뒤 공백 제거, 비었거나 500자 초과면 보내지 않는다. 성공 여부. */
  const addComment = useCallback(
    async (raw: string): Promise<boolean> => {
      const content = raw.trim();
      if (postId == null || !content || content.length > FEED_MAX_COMMENT) return false;
      if (sendingRef.current) return false;
      const pending = pendingComment.current;
      const clientCommentId =
        pending && pending.postId === postId && pending.content === content
          ? pending.id
          : newFeedClientId();
      pendingComment.current = { postId, content, id: clientCommentId };
      sendingRef.current = true;
      try {
        const comment = await createCommentAsync({ postId, clientCommentId, content });
        pendingComment.current = null;
        const cached = qc.getQueryData<FeedCommentPages>(commentsKey);
        // 재시도가 원래 댓글을 돌려준 경우(이미 목록에 있음)는 붙이지도, 개수를 올리지도 않는다.
        const already = cached?.pages.some((p) =>
          p.items.some((c) => c.commentId === comment.commentId),
        );
        if (!already) {
          qc.setQueryData<FeedCommentPages>(commentsKey, (data) => {
            const last = data?.pages[data.pages.length - 1];
            if (!data || !last || last.hasNext) return data;
            return {
              ...data,
              pages: [...data.pages.slice(0, -1), { ...last, items: [...last.items, comment] }],
            };
          });
          patchFeedPost(qc, userId, postId, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
        }
        track('feed_comment');
        return true;
      } catch (err) {
        if (isFeedPostGone(err)) removeFeedPost(qc, userId, postId);
        // 입력 자체가 거부된 경우는 같은 id를 다시 쓸 이유가 없다.
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          pendingComment.current = null;
        }
        onErrorRef.current?.(feedErrorMessage(err));
        return false;
      } finally {
        sendingRef.current = false;
      }
    },
    [postId, qc, userId, commentsKey, createCommentAsync, onErrorRef],
  );

  /** 내 댓글 삭제 — 이미 없으면(404) 성공으로 보고 목록에서 뺀다. */
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
      let removed = false;
      qc.setQueryData<FeedCommentPages>(commentsKey, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => {
                const items = page.items.filter((c) => c.commentId !== commentId);
                if (items.length !== page.items.length) removed = true;
                return { ...page, items };
              }),
            }
          : data,
      );
      if (removed) {
        patchFeedPost(qc, userId, postId, (p) => ({
          ...p,
          commentCount: Math.max(0, p.commentCount - 1),
        }));
      }
      return true;
    },
    [postId, qc, userId, commentsKey, deleteCommentAsync, onErrorRef],
  );

  const busyRef = useLatestRef(commentsQuery.isFetching);
  const hasNextRef = useLatestRef(commentsQuery.hasNextPage);
  const fetchNextComments = commentsQuery.fetchNextPage;
  const loadMoreComments = useCallback(() => {
    if (busyRef.current || !hasNextRef.current) return;
    void fetchNextComments().catch(() => {});
  }, [busyRef, hasNextRef, fetchNextComments]);

  const refetchPost = postQuery.refetch;
  const refetchComments = commentsQuery.refetch;
  const retry = useCallback(() => {
    void refetchPost();
    void refetchComments();
  }, [refetchPost, refetchComments]);

  const actions = useFeedActions({ onError });

  const post = postQuery.data ?? null;
  const notFound = isFeedPostGone(postQuery.error);
  const loading = postId != null && postQuery.isPending;
  const error = postQuery.isError && !notFound && !post;
  const comments = commentsQuery.data ?? NO_COMMENTS;
  const commentsLoading = postId != null && commentsQuery.isPending;
  const commentsError = commentsQuery.isError && !commentsQuery.isFetchNextPageError;
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
      hasMoreComments,
      loadMoreComments,
      addComment,
      deleteComment,
      retry,
      actions,
    ],
  );
}
