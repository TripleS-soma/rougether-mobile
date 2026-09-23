/**
 * 피드 캐시 조작·오류 문구 공용 (#1409) — 목록(무한 쿼리 여러 개)과 상세가 같은 게시물을
 * 따로 들고 있으므로, 좋아요·댓글 수·본문 수정·삭제는 여기 함수로 **양쪽을 함께** 고친다.
 */
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/http';
import type { Page } from '@/api/client';
import type { FeedComment, FeedPost } from '@/components/screens/feed/types';
import { i18n } from '@/i18n';
import { queryKeys } from '@/lib/query-keys';

export type FeedCursor = number | undefined;
export type FeedPostPages = InfiniteData<Page<FeedPost>, FeedCursor>;
export type FeedCommentPages = InfiniteData<Page<FeedComment>, FeedCursor>;

type UserId = number | null | undefined;

/** 목록 전부(전체·작성자별)와 상세에서 이 게시물을 고친다. */
export function patchFeedPost(
  qc: QueryClient,
  userId: UserId,
  postId: number,
  update: (post: FeedPost) => FeedPost,
) {
  qc.setQueriesData<FeedPostPages>({ queryKey: queryKeys.feed.lists(userId) }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((p) => (p.postId === postId ? update(p) : p)),
          })),
        }
      : data,
  );
  qc.setQueryData<FeedPost>(queryKeys.feed.post(userId, postId), (post) =>
    post ? update(post) : post,
  );
}

/** 캐시에 있는 이 게시물의 현재 모습 — 상세가 우선, 없으면 목록에서. */
export function findFeedPost(
  qc: QueryClient,
  userId: UserId,
  postId: number,
): FeedPost | undefined {
  const detail = qc.getQueryData<FeedPost>(queryKeys.feed.post(userId, postId));
  if (detail) return detail;
  for (const [, data] of qc.getQueriesData<FeedPostPages>({
    queryKey: queryKeys.feed.lists(userId),
  })) {
    for (const page of data?.pages ?? []) {
      const hit = page.items.find((p) => p.postId === postId);
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * 삭제된 게시물을 캐시에서 지운다 — spec: "프론트도 삭제 후 캐시를 비운다". 목록에서 빼고
 * 상세·댓글 쿼리는 통째로 버린다.
 */
export function removeFeedPost(qc: QueryClient, userId: UserId, postId: number) {
  qc.setQueriesData<FeedPostPages>({ queryKey: queryKeys.feed.lists(userId) }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter((p) => p.postId !== postId),
          })),
        }
      : data,
  );
  qc.removeQueries({ queryKey: queryKeys.feed.post(userId, postId), exact: true });
  qc.removeQueries({ queryKey: queryKeys.feed.comments(userId, postId), exact: true });
}

/** 게시물이 서버에서 사라졌는가 (삭제·탈퇴로 숨김). */
export function isFeedPostGone(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'FEED_POST_NOT_FOUND';
}

/** 사용자가 마주칠 수 있는 오류 코드 → 안내 문구. 모르는 코드·네트워크 오류는 일반 문구. */
export function feedErrorMessage(err: unknown): string {
  const code = err instanceof ApiError ? err.code : undefined;
  if (code && code.startsWith('FEED_') && i18n.exists(`feed.error.${code}`)) {
    return i18n.t(`feed.error.${code}`);
  }
  return i18n.t('feed.error.generic');
}

/**
 * 재시도 식별용 UUID(v4) — 인증 수단이 아니다. `crypto.randomUUID`가 있으면(웹·Hermes 최신)
 * 그걸, 없으면 Math.random 기반으로 만든다(use-furniture-studio의 requestId와 같은 결).
 */
export function newFeedClientId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = Math.floor(Math.random() * 16);
    return (ch === 'x' ? n : (n & 3) | 8).toString(16);
  });
}
