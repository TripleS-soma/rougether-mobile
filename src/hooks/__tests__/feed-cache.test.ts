import type { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/http';
import type { FeedComment, FeedPost } from '@/components/screens/feed/types';
import {
  type FeedCommentPages,
  type FeedPostPages,
  feedErrorMessage,
  findFeedPost,
  isFeedPostGone,
  newFeedClientId,
  patchFeedPost,
  removeFeedAuthor,
  removeFeedPost,
} from '@/hooks/feed-cache';
import { queryKeys } from '@/lib/query-keys';
import { createTestQueryClient } from '@/test-utils/query-wrapper';

/**
 * 피드 캐시 조작 (#1409) — 목록은 게시판·작성자별 무한 쿼리 여러 개, 상세는 단건 쿼리.
 * 같은 게시물이 여러 곳에 있으니 패치·삭제가 **모두** 고치고, 다른 계정 캐시는 건드리지 않는지 본다.
 */

const ME = 4;
const OTHER_ACCOUNT = 9;

function post(postId: number, authorId = 100, over: Partial<FeedPost> = {}): FeedPost {
  return {
    postId,
    author: { userId: authorId, nickname: `u${authorId}`, profileImageKey: null },
    boardType: 'FREE',
    content: `post ${postId}`,
    routine: null,
    images: [],
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    mine: false,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  };
}

function comment(commentId: number, postId: number, authorId: number): FeedComment {
  return {
    commentId,
    postId,
    author: { userId: authorId, nickname: `u${authorId}`, profileImageKey: null },
    content: `c${commentId}`,
    mine: false,
    createdAt: '2026-10-01T00:00:00Z',
  };
}

function pages<T>(...chunks: T[][]) {
  return {
    pages: chunks.map((items, i) => ({
      items,
      hasNext: i < chunks.length - 1,
      nextCursor: i < chunks.length - 1 ? 1000 - i : undefined,
    })),
    pageParams: chunks.map((_, i) => (i === 0 ? undefined : 1000 - i + 1)),
  };
}

const ALL_KEY = queryKeys.feed.list(ME, null, 'ALL');
const FREE_KEY = queryKeys.feed.list(ME, null, 'FREE');
const MINE_KEY = queryKeys.feed.list(ME, ME, 'ALL');

function listItems(qc: QueryClient, key: readonly unknown[]): number[][] | undefined {
  return qc.getQueryData<FeedPostPages>(key)?.pages.map((p) => p.items.map((x) => x.postId));
}

let qc: QueryClient;
beforeEach(() => {
  qc = createTestQueryClient();
});
afterEach(() => qc.clear());

describe('patchFeedPost', () => {
  it('고친다 — 여러 페이지·여러 게시판 목록과 상세에 있는 같은 게시물을 전부', () => {
    qc.setQueryData<FeedPostPages>(ALL_KEY, pages([post(1), post(2)], [post(3), post(4)]));
    qc.setQueryData<FeedPostPages>(FREE_KEY, pages([post(5)], [post(3)]));
    qc.setQueryData<FeedPost>(queryKeys.feed.post(ME, 3), post(3));

    patchFeedPost(qc, ME, 3, (p) => ({ ...p, likeCount: p.likeCount + 1, likedByMe: true }));

    const allHit = qc.getQueryData<FeedPostPages>(ALL_KEY)!.pages[1].items[0];
    const freeHit = qc.getQueryData<FeedPostPages>(FREE_KEY)!.pages[1].items[0];
    expect(allHit).toMatchObject({ postId: 3, likeCount: 1, likedByMe: true });
    expect(freeHit).toMatchObject({ postId: 3, likeCount: 1, likedByMe: true });
    expect(qc.getQueryData<FeedPost>(queryKeys.feed.post(ME, 3))).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });

  it('다른 게시물은 객체째 그대로 두고, 페이지 구조·커서도 유지한다', () => {
    const untouched = post(1);
    const before = pages([untouched, post(2)], [post(3)]);
    qc.setQueryData<FeedPostPages>(ALL_KEY, before);

    patchFeedPost(qc, ME, 2, (p) => ({ ...p, commentCount: 7 }));

    const after = qc.getQueryData<FeedPostPages>(ALL_KEY)!;
    expect(after.pages[0].items[0]).toBe(untouched);
    expect(after.pages[0].items[1].commentCount).toBe(7);
    expect(after.pageParams).toEqual(before.pageParams);
    expect(after.pages.map((p) => [p.hasNext, p.nextCursor])).toEqual(
      before.pages.map((p) => [p.hasNext, p.nextCursor]),
    );
  });

  it('다른 계정의 피드 캐시는 건드리지 않는다', () => {
    qc.setQueryData<FeedPostPages>(queryKeys.feed.list(OTHER_ACCOUNT, null), pages([post(3)]));
    qc.setQueryData<FeedPost>(queryKeys.feed.post(OTHER_ACCOUNT, 3), post(3));

    patchFeedPost(qc, ME, 3, (p) => ({ ...p, likeCount: 99 }));

    expect(
      qc.getQueryData<FeedPostPages>(queryKeys.feed.list(OTHER_ACCOUNT, null))!.pages[0].items[0]
        .likeCount,
    ).toBe(0);
    expect(qc.getQueryData<FeedPost>(queryKeys.feed.post(OTHER_ACCOUNT, 3))!.likeCount).toBe(0);
  });

  it('캐시가 비어 있으면 아무것도 만들지 않는다 (상세 쿼리를 새로 심지 않음)', () => {
    const update = jest.fn((p: FeedPost) => p);
    patchFeedPost(qc, ME, 3, update);

    expect(update).not.toHaveBeenCalled();
    expect(qc.getQueryData(queryKeys.feed.post(ME, 3))).toBeUndefined();
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe('findFeedPost', () => {
  it('상세가 있으면 상세를 우선한다', () => {
    qc.setQueryData<FeedPostPages>(ALL_KEY, pages([post(3, 100, { content: 'list' })]));
    qc.setQueryData<FeedPost>(queryKeys.feed.post(ME, 3), post(3, 100, { content: 'detail' }));

    expect(findFeedPost(qc, ME, 3)?.content).toBe('detail');
  });

  it('상세가 없으면 목록의 뒤쪽 페이지까지 찾는다', () => {
    qc.setQueryData<FeedPostPages>(ALL_KEY, pages([post(1)], [post(2)]));
    qc.setQueryData<FeedPostPages>(FREE_KEY, pages([post(8, 100, { content: 'free' })]));

    expect(findFeedPost(qc, ME, 2)?.postId).toBe(2);
    expect(findFeedPost(qc, ME, 8)?.content).toBe('free');
  });

  it('어디에도 없거나 다른 계정 캐시에만 있으면 undefined', () => {
    expect(findFeedPost(qc, ME, 3)).toBeUndefined();
    qc.setQueryData<FeedPostPages>(queryKeys.feed.list(OTHER_ACCOUNT, null), pages([post(3)]));
    expect(findFeedPost(qc, ME, 3)).toBeUndefined();
  });
});

describe('removeFeedPost', () => {
  it('모든 목록에서 빼고 그 게시물의 상세·댓글 쿼리를 버린다', () => {
    qc.setQueryData<FeedPostPages>(ALL_KEY, pages([post(1), post(2)], [post(3)]));
    qc.setQueryData<FeedPostPages>(MINE_KEY, pages([post(2)]));
    qc.setQueryData<FeedPost>(queryKeys.feed.post(ME, 2), post(2));
    qc.setQueryData<FeedCommentPages>(queryKeys.feed.comments(ME, 2), pages([comment(1, 2, 7)]));
    // 다른 게시물의 상세·댓글은 남아야 한다.
    qc.setQueryData<FeedPost>(queryKeys.feed.post(ME, 3), post(3));
    qc.setQueryData<FeedCommentPages>(queryKeys.feed.comments(ME, 3), pages([comment(2, 3, 7)]));

    removeFeedPost(qc, ME, 2);

    expect(listItems(qc, ALL_KEY)).toEqual([[1], [3]]);
    expect(listItems(qc, MINE_KEY)).toEqual([[]]);
    expect(qc.getQueryState(queryKeys.feed.post(ME, 2))).toBeUndefined();
    expect(qc.getQueryState(queryKeys.feed.comments(ME, 2))).toBeUndefined();
    expect(qc.getQueryData(queryKeys.feed.post(ME, 3))).toBeDefined();
    expect(qc.getQueryData(queryKeys.feed.comments(ME, 3))).toBeDefined();
  });

  it('캐시가 비어 있어도 던지지 않는다', () => {
    expect(() => removeFeedPost(qc, ME, 2)).not.toThrow();
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe('removeFeedAuthor (#1428 차단)', () => {
  it('그 작성자의 글을 모든 목록·페이지에서, 댓글을 모든 게시물에서 뺀다', () => {
    const BLOCKED = 200;
    qc.setQueryData<FeedPostPages>(
      ALL_KEY,
      pages([post(1, BLOCKED), post(2)], [post(3, BLOCKED), post(4)]),
    );
    qc.setQueryData<FeedPostPages>(FREE_KEY, pages([post(3, BLOCKED)]));
    qc.setQueryData<FeedCommentPages>(
      queryKeys.feed.comments(ME, 2),
      pages([comment(10, 2, BLOCKED), comment(11, 2, 7)]),
    );
    qc.setQueryData<FeedCommentPages>(
      queryKeys.feed.comments(ME, 4),
      pages([comment(12, 4, 7)], [comment(13, 4, BLOCKED)]),
    );
    qc.setQueryData<FeedPost>(queryKeys.feed.post(ME, 1), post(1, BLOCKED));

    removeFeedAuthor(qc, ME, BLOCKED);

    expect(listItems(qc, ALL_KEY)).toEqual([[2], [4]]);
    expect(listItems(qc, FREE_KEY)).toEqual([[]]);
    const commentIds = (postId: number) =>
      qc
        .getQueryData<FeedCommentPages>(queryKeys.feed.comments(ME, postId))!
        .pages.map((p) => p.items.map((c) => c.commentId));
    expect(commentIds(2)).toEqual([[11]]);
    expect(commentIds(4)).toEqual([[12], []]);
    // 떠나는 전환(#1094) 동안 그릴 상세는 남긴다.
    expect(qc.getQueryData<FeedPost>(queryKeys.feed.post(ME, 1))?.postId).toBe(1);
  });

  it('다른 계정의 캐시는 그대로 둔다', () => {
    qc.setQueryData<FeedPostPages>(queryKeys.feed.list(OTHER_ACCOUNT, null), pages([post(1, 200)]));
    removeFeedAuthor(qc, ME, 200);
    expect(listItems(qc, queryKeys.feed.list(OTHER_ACCOUNT, null))).toEqual([[1]]);
  });
});

describe('isFeedPostGone · feedErrorMessage', () => {
  const apiErr = (code: string, status = 404) =>
    new ApiError(status, 'GET', '/feed/posts/1', JSON.stringify({ code }));

  it('FEED_POST_NOT_FOUND만 사라진 게시물로 본다', () => {
    expect(isFeedPostGone(apiErr('FEED_POST_NOT_FOUND'))).toBe(true);
    expect(isFeedPostGone(apiErr('HOUSE_NOT_FOUND'))).toBe(false);
    expect(isFeedPostGone(new Error('network'))).toBe(false);
  });

  it('아는 FEED_ 코드는 전용 문구, 그 외는 일반 문구', () => {
    expect(feedErrorMessage(apiErr('FEED_POST_NOT_FOUND'))).toBe(
      '삭제되었거나 볼 수 없는 게시물이에요.',
    );
    const generic = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
    expect(feedErrorMessage(apiErr('FEED_NO_SUCH_CODE_EVER'))).toBe(generic);
    expect(feedErrorMessage(apiErr('HOUSE_NOT_FOUND'))).toBe(generic);
    expect(feedErrorMessage(new TypeError('Network request failed'))).toBe(generic);
  });
});

describe('newFeedClientId', () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('crypto.randomUUID가 없어도 v4 모양을 만든다', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    try {
      const ids = Array.from({ length: 50 }, newFeedClientId);
      ids.forEach((id) => expect(id).toMatch(UUID_V4));
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
      else delete (globalThis as { crypto?: unknown }).crypto;
    }
  });
});
