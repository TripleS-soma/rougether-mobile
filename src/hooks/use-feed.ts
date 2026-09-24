/**
 * 공개 피드 목록·좋아요·삭제 (#1409) — react-query (AGENTS.md 서버 상태 규칙).
 *
 * 목록은 cursor 무한 쿼리(`id < cursor`, 최신순). 좋아요는 낙관적으로 목록·상세 캐시를
 * 함께 뒤집고 실패하면 되돌린다. 돌려주는 객체와 함수는 참조가 고정된다(#539) —
 * `useMutation` 객체 대신 `mutateAsync`만 꺼내 쓰고, 중복 탭 가드는 ref로 읽는다.
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { getSessionUserId } from '@/api/auth';
import {
  clearFeedImageCache,
  deleteFeedPost,
  fetchFeedPosts,
  likeFeedPost,
  unlikeFeedPost,
  updateFeedPost,
} from '@/api/feed';
import type { FeedPost } from '@/components/screens/feed/types';
import { FEED_PAGE_SIZE } from '@/constants/feed';
import {
  type FeedCursor,
  type FeedPostPages,
  feedErrorMessage,
  findFeedPost,
  isFeedPostGone,
  patchFeedPost,
  removeFeedPost,
} from '@/hooks/feed-cache';
import { useLatestRef } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';

const NO_POSTS: FeedPost[] = [];

/** 페이지들을 한 목록으로 — 새로고침 경계에서 겹친 글은 한 번만. 모듈 스코프라 메모된다. */
const selectPosts = (data: FeedPostPages): FeedPost[] => {
  const seen = new Set<number>();
  const out: FeedPost[] = [];
  for (const page of data.pages) {
    for (const post of page.items) {
      if (seen.has(post.postId)) continue;
      seen.add(post.postId);
      out.push(post);
    }
  }
  return out;
};

type FeedErrorHandler = (message: string) => void;

/**
 * 게시물 단위 동작 — 목록과 상세가 같이 쓴다. 캐시 갱신은 `feed-cache`가 양쪽을 함께 고친다.
 */
export function useFeedActions({ onError }: { onError?: FeedErrorHandler } = {}) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const onErrorRef = useLatestRef(onError);

  const { mutateAsync: likeAsync } = useMutation({
    mutationFn: ({ postId, like }: { postId: number; like: boolean }) =>
      like ? likeFeedPost(postId) : unlikeFeedPost(postId),
  });
  const { mutateAsync: deleteAsync } = useMutation({ mutationFn: deleteFeedPost });
  const { mutateAsync: updateAsync } = useMutation({
    mutationFn: ({ postId, content }: { postId: number; content: string }) =>
      updateFeedPost(postId, content),
  });

  // 같은 글의 좋아요 요청이 겹치지 않게 — 서버는 멱등이지만 낙관 반영이 꼬인다.
  const pendingLikes = useRef(new Set<number>());

  /** 좋아요 토글 — 낙관 반영 후 실패하면 되돌린다. 성공 여부를 돌려준다. */
  const toggleLike = useCallback(
    async (postId: number): Promise<boolean> => {
      if (pendingLikes.current.has(postId)) return false;
      const current = findFeedPost(qc, userId, postId);
      if (!current) return false;
      const like = !current.likedByMe;
      const flip = (p: FeedPost, on: boolean): FeedPost => ({
        ...p,
        likedByMe: on,
        likeCount: Math.max(0, p.likeCount + (on ? 1 : -1)),
      });
      pendingLikes.current.add(postId);
      patchFeedPost(qc, userId, postId, (p) => (p.likedByMe === like ? p : flip(p, like)));
      try {
        await likeAsync({ postId, like });
        track('feed_like', { liked: like });
        return true;
      } catch (err) {
        if (isFeedPostGone(err)) removeFeedPost(qc, userId, postId);
        else patchFeedPost(qc, userId, postId, (p) => (p.likedByMe === like ? flip(p, !like) : p));
        onErrorRef.current?.(feedErrorMessage(err));
        return false;
      } finally {
        pendingLikes.current.delete(postId);
      }
    },
    [qc, userId, likeAsync, onErrorRef],
  );

  /** 내 게시물 삭제 — 성공(또는 이미 없음)이면 캐시·사진을 비우고 true. */
  const deletePost = useCallback(
    async (postId: number): Promise<boolean> => {
      const imageIds = findFeedPost(qc, userId, postId)?.images.map((i) => i.imageId) ?? [];
      try {
        await deleteAsync(postId);
      } catch (err) {
        if (!isFeedPostGone(err)) {
          onErrorRef.current?.(feedErrorMessage(err));
          return false;
        }
      }
      removeFeedPost(qc, userId, postId);
      clearFeedImageCache(imageIds);
      return true;
    },
    [qc, userId, deleteAsync, onErrorRef],
  );

  /** 내 게시물 본문 수정(빈 문자열 허용) — 응답으로 목록·상세를 맞춘다. */
  const editPost = useCallback(
    async (postId: number, content: string): Promise<boolean> => {
      try {
        const updated = await updateAsync({ postId, content: content.trim() });
        patchFeedPost(qc, userId, postId, (p) => ({
          ...p,
          content: updated.content,
          updatedAt: updated.updatedAt,
        }));
        return true;
      } catch (err) {
        if (isFeedPostGone(err)) removeFeedPost(qc, userId, postId);
        onErrorRef.current?.(feedErrorMessage(err));
        return false;
      }
    },
    [qc, userId, updateAsync, onErrorRef],
  );

  return useMemo(() => ({ toggleLike, deletePost, editPost }), [toggleLike, deletePost, editPost]);
}

/**
 * 전체 공개 피드 (GET /feed/posts). `enabled=false`면 요청하지 않는다 — 셸에 상주하므로
 * 피드가 꺼져 있거나(FEED_ENABLED) 아직 탭을 안 연 동안엔 받지 않는다.
 */
export function useFeed({
  enabled = true,
  onError,
}: { enabled?: boolean; onError?: FeedErrorHandler } = {}) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  // 키는 userId로 메모 — 매 렌더 새 배열이면 refresh 참조가 흔들린다 (#539).
  const queryKey = useMemo(() => queryKeys.feed.list(userId, null), [userId]);

  const {
    data,
    isPending,
    isError,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchFeedPosts({ cursor: pageParam, size: FEED_PAGE_SIZE }),
    initialPageParam: undefined as FeedCursor,
    getNextPageParam: (last) =>
      last.hasNext && last.nextCursor != null ? last.nextCursor : undefined,
    select: selectPosts,
    enabled,
  });

  /** 당겨서 새로고침 — spec: cursor 없이 다시. 이어 붙인 페이지는 버리고 첫 장만 받는다. */
  const refresh = useCallback(async () => {
    qc.setQueryData<FeedPostPages>(queryKey, (prev) =>
      prev && prev.pages.length > 1
        ? { pages: prev.pages.slice(0, 1), pageParams: prev.pageParams.slice(0, 1) }
        : prev,
    );
    await refetch();
  }, [qc, queryKey, refetch]);

  const busyRef = useLatestRef(isFetching);
  const hasNextRef = useLatestRef(hasNextPage);
  const loadMore = useCallback(() => {
    if (busyRef.current || !hasNextRef.current) return;
    void fetchNextPage().catch(() => {
      // 더보기 실패는 목록을 유지한 채 접는다 — 다음 스크롤 끝에서 다시 시도된다.
    });
  }, [busyRef, hasNextRef, fetchNextPage]);

  const actions = useFeedActions({ onError });

  const posts = data ?? NO_POSTS;
  const loading = enabled && isPending;
  // 첫 페이지 실패만 에러 화면 — 더보기 실패는 기존 목록을 그대로 둔다.
  const error = isError && !isFetchNextPageError && posts.length === 0;

  return useMemo(
    () => ({
      posts,
      loading,
      error,
      loadingMore: isFetchingNextPage,
      hasNext: hasNextPage,
      refresh,
      loadMore,
      ...actions,
    }),
    [posts, loading, error, isFetchingNextPage, hasNextPage, refresh, loadMore, actions],
  );
}
