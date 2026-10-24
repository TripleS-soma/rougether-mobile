import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getSessionUserId } from '@/api/auth';
import {
  createFeedComment,
  deleteFeedComment,
  fetchFeedComments,
  fetchFeedPost,
  fetchFeedReplies,
} from '@/api/feed';
import { ApiError } from '@/api/http';
import type { FeedComment } from '@/components/screens/feed/types';
import { useFeedPost, useFeedReplies } from '@/hooks/use-feed-post';
import { queryKeys } from '@/lib/query-keys';
import { DEMO_FEED_COMMENTS, DEMO_FEED_POSTS } from '@/mocks/fixtures';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/auth', () => ({
  ...jest.requireActual('@/api/auth'),
  getSessionUserId: jest.fn(() => 7),
}));
jest.mock('@/api/feed', () => ({
  fetchFeedPost: jest.fn(),
  fetchFeedComments: jest.fn(),
  fetchFeedReplies: jest.fn(),
  createFeedComment: jest.fn(),
  deleteFeedComment: jest.fn(),
  likeFeedPost: jest.fn(),
  unlikeFeedPost: jest.fn(),
  deleteFeedPost: jest.fn(),
  updateFeedPost: jest.fn(),
  clearFeedImageCache: jest.fn(),
}));

const POST = DEMO_FEED_POSTS[0];
const REPLY: FeedComment = {
  ...DEMO_FEED_COMMENTS[1],
  commentId: 401,
  parentCommentId: 301,
  replyToCommentId: 301,
  content: '나도!',
};
let stored: FeedComment[];
const clients: ReturnType<typeof createTestQueryClient>[] = [];
function wrapper() {
  const client = createTestQueryClient();
  clients.push(client);
  return queryWrapper(client);
}
function roots() {
  return stored
    .filter((c) => c.parentCommentId == null)
    .map((c) => ({
      ...c,
      replyCount: stored.filter((r) => r.parentCommentId === c.commentId).length,
    }))
    .filter((c) => !c.deleted || c.replyCount > 0);
}

beforeEach(() => {
  stored = DEMO_FEED_COMMENTS.map((c) => ({ ...c }));
  jest.mocked(getSessionUserId).mockReturnValue(7);
  jest
    .mocked(fetchFeedPost)
    .mockReset()
    .mockImplementation(async () => ({
      ...POST,
      commentCount: stored.filter((c) => !c.deleted).length,
    }));
  jest
    .mocked(fetchFeedComments)
    .mockReset()
    .mockImplementation(async () => ({ items: roots(), hasNext: false }));
  jest
    .mocked(fetchFeedReplies)
    .mockReset()
    .mockImplementation(async (_p, root) => ({
      items: stored.filter((c) => c.parentCommentId === root),
      hasNext: false,
    }));
  jest
    .mocked(createFeedComment)
    .mockReset()
    .mockImplementation(async (_post, input) => {
      const target = stored.find((c) => c.commentId === input.replyToCommentId);
      const comment = {
        ...DEMO_FEED_COMMENTS[1],
        content: input.content,
        commentId: 500 + stored.length,
        parentCommentId: target ? (target.parentCommentId ?? target.commentId) : null,
        replyToCommentId: input.replyToCommentId ?? null,
      };
      stored.push(comment);
      return comment;
    });
  jest
    .mocked(deleteFeedComment)
    .mockReset()
    .mockImplementation(async (_post, id) => {
      stored = stored.flatMap((c) =>
        c.commentId !== id
          ? [c]
          : c.parentCommentId != null
            ? []
            : [
                {
                  ...c,
                  deleted: true,
                  content: '',
                  mine: false,
                  author: { userId: 0, nickname: null, profileImageKey: null },
                },
              ],
      );
    });
});
afterEach(() => clients.splice(0).forEach((c) => c.clear()));

describe('useFeedPost 대댓글 (#1570)', () => {
  it('원댓글만 조회하고 등록 후 서버 댓글 수와 목록을 갱신한다', async () => {
    const { result } = await renderHook(() => useFeedPost(3), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.comments).toHaveLength(2));
    expect(fetchFeedComments).toHaveBeenCalledWith(3, {
      size: 20,
      cursor: undefined,
      topLevelOnly: true,
    });
    await act(async () => {
      await result.current.addComment('  반가워요  ');
    });
    const [id, input] = jest.mocked(createFeedComment).mock.calls[0];
    expect(id).toBe(3);
    expect(input.content).toBe('반가워요');
    expect(input.clientCommentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(input).not.toHaveProperty('replyToCommentId');
    await waitFor(() => expect(result.current.comments).toHaveLength(3));
    await waitFor(() => expect(result.current.post?.commentCount).toBe(3));
  });

  it('대댓글에 답하면 실제 대상 id로 등록하고 원댓글·펼친 답글을 함께 갱신한다', async () => {
    stored.push(REPLY);
    const { result } = await renderHook(
      () => ({ detail: useFeedPost(3), replies: useFeedReplies(3, 301) }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.replies.comments).toHaveLength(1));
    await act(async () => {
      await result.current.detail.addComment('나도 갈래', 401);
    });
    expect(createFeedComment).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ content: '나도 갈래', replyToCommentId: 401 }),
    );
    await waitFor(() => expect(result.current.replies.comments).toHaveLength(2));
    expect(result.current.replies.comments[1]).toMatchObject({
      parentCommentId: 301,
      replyToCommentId: 401,
    });
    expect(result.current.detail.comments).toHaveLength(2);
    expect(result.current.detail.comments[0].replyCount).toBe(2);
    expect(result.current.detail.post?.commentCount).toBe(4);
  });

  it('본문과 대상이 같은 네트워크 재시도만 같은 UUID, 대상을 바꾸면 새 UUID', async () => {
    jest.mocked(createFeedComment).mockRejectedValue(new TypeError('Network request failed'));
    const { result } = await renderHook(() => useFeedPost(3), { wrapper: wrapper() });
    await act(async () => {
      await result.current.addComment('반가워요', 301);
    });
    await act(async () => {
      await result.current.addComment('반가워요', 301);
    });
    await act(async () => {
      await result.current.addComment('반가워요', 302);
    });
    await act(async () => {
      await result.current.addComment('반가워요');
    });
    const [a, b, c, d] = jest.mocked(createFeedComment).mock.calls.map((call) => call[1]);
    expect(a.clientCommentId).toBe(b.clientCommentId);
    expect(c.clientCommentId).not.toBe(a.clientCommentId);
    expect(d.clientCommentId).not.toBe(c.clientCommentId);
  });

  it('응답 유실 후 서버가 같은 답글을 돌려줘도 중복 행·개수가 생기지 않는다', async () => {
    stored.push(REPLY);
    jest.mocked(createFeedComment).mockResolvedValue(REPLY);
    const { result } = await renderHook(
      () => ({ detail: useFeedPost(3), replies: useFeedReplies(3, 301) }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.replies.comments).toHaveLength(1));
    await act(async () => {
      await result.current.detail.addComment('나도!', 301);
    });
    expect(result.current.replies.comments).toHaveLength(1);
    expect(result.current.detail.post?.commentCount).toBe(3);
  });

  it('원댓글 삭제는 tombstone과 남의 답글을 남기고 마지막 답글 삭제 후 스레드가 사라진다', async () => {
    stored.push(REPLY);
    const { result } = await renderHook(
      () => ({ detail: useFeedPost(3), replies: useFeedReplies(3, 301) }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.detail.comments).toHaveLength(2));
    await act(async () => {
      await result.current.detail.deleteComment(301);
    });
    await waitFor(() =>
      expect(result.current.detail.comments[0]).toMatchObject({
        deleted: true,
        replyCount: 1,
        content: '',
      }),
    );
    expect(result.current.replies.comments).toEqual([REPLY]);
    expect(result.current.detail.post?.commentCount).toBe(2);
    await act(async () => {
      await result.current.detail.deleteComment(401);
    });
    await waitFor(() =>
      expect(result.current.detail.comments.map((c) => c.commentId)).toEqual([302]),
    );
    expect(result.current.detail.post?.commentCount).toBe(1);
  });

  it('사라진 대상 404는 입력 실패로 알리고 새 요청은 새 UUID를 쓴다', async () => {
    jest
      .mocked(createFeedComment)
      .mockRejectedValueOnce(
        new ApiError(
          404,
          'POST',
          '/feed/posts/3/comments',
          JSON.stringify({ code: 'FEED_COMMENT_NOT_FOUND' }),
        ),
      );
    const onError = jest.fn();
    const { result } = await renderHook(() => useFeedPost(3, { onError }), { wrapper: wrapper() });
    await act(async () => {
      expect(await result.current.addComment('반가워요', 301)).toBe(false);
    });
    expect(onError).toHaveBeenCalledWith('이미 삭제된 댓글이에요.');
    await act(async () => {
      await result.current.addComment('반가워요', 301);
    });
    const [a, b] = jest.mocked(createFeedComment).mock.calls.map((call) => call[1]);
    expect(a.clientCommentId).not.toBe(b.clientCommentId);
  });

  it('화면 새로고침은 나중에 도착한 대댓글도 다시 받는다', async () => {
    const { result } = await renderHook(
      () => ({ detail: useFeedPost(3), replies: useFeedReplies(3, 301) }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.replies.loading).toBe(false));
    stored.push(REPLY);
    await act(async () => {
      result.current.detail.retry();
    });
    await waitFor(() => expect(result.current.replies.comments).toEqual([REPLY]));
  });

  it('대댓글 더보기 cursor는 원댓글 cursor와 별개이고 중복 응답은 한 번만 그린다', async () => {
    jest
      .mocked(fetchFeedReplies)
      .mockResolvedValueOnce({ items: [REPLY], nextCursor: 401, hasNext: true })
      .mockResolvedValueOnce({ items: [REPLY, { ...REPLY, commentId: 402 }], hasNext: false });
    const { result } = await renderHook(() => useFeedReplies(3, 301), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => {
      result.current.onLoadMore();
    });
    await waitFor(() => expect(result.current.comments).toHaveLength(2));
    expect(fetchFeedReplies).toHaveBeenLastCalledWith(3, 301, { cursor: 401, size: 20 });
    expect(fetchFeedComments).not.toHaveBeenCalled();
  });

  it('대댓글 조회 실패는 재시도할 수 있고 다른 계정 캐시는 읽지 않는다', async () => {
    jest.mocked(fetchFeedReplies).mockRejectedValueOnce(new TypeError('Network request failed'));
    const client = createTestQueryClient();
    clients.push(client);
    client.setQueryData(queryKeys.feed.replies(9, 3, 301), {
      pages: [{ items: [REPLY], hasNext: false }],
      pageParams: [undefined],
    });
    const { result } = await renderHook(() => useFeedReplies(3, 301), {
      wrapper: queryWrapper(client),
    });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.comments).toEqual([]);
    await act(async () => {
      result.current.onRetry();
    });
    await waitFor(() => expect(result.current.error).toBe(false));
    expect(client.getQueryData(queryKeys.feed.replies(9, 3, 301))).toBeDefined();
  });

  it('삭제된 글(404 FEED_POST_NOT_FOUND)은 notFound', async () => {
    jest
      .mocked(fetchFeedPost)
      .mockRejectedValue(
        new ApiError(404, 'GET', '/feed/posts/3', JSON.stringify({ code: 'FEED_POST_NOT_FOUND' })),
      );
    const { result } = await renderHook(() => useFeedPost(3), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.error).toBe(false);
  });
});
