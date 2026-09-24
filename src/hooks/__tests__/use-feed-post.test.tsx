import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createFeedComment, fetchFeedComments, fetchFeedPost } from '@/api/feed';
import { ApiError } from '@/api/http';
import { useFeedPost } from '@/hooks/use-feed-post';
import { DEMO_FEED_COMMENTS, DEMO_FEED_POSTS } from '@/mocks/fixtures';
import { queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/feed', () => ({
  fetchFeedPost: jest.fn(),
  fetchFeedComments: jest.fn(),
  createFeedComment: jest.fn(),
  deleteFeedComment: jest.fn(),
  likeFeedPost: jest.fn(),
  unlikeFeedPost: jest.fn(),
  deleteFeedPost: jest.fn(),
  updateFeedPost: jest.fn(),
  clearFeedImageCache: jest.fn(),
}));

const POST = DEMO_FEED_POSTS[0];
const NEW_COMMENT = { ...DEMO_FEED_COMMENTS[1], commentId: 303, content: '반가워요' };

beforeEach(() => {
  jest.mocked(fetchFeedPost).mockReset().mockResolvedValue(POST);
  jest
    .mocked(fetchFeedComments)
    .mockReset()
    .mockResolvedValue({ items: DEMO_FEED_COMMENTS, hasNext: false });
  jest.mocked(createFeedComment).mockReset().mockResolvedValue(NEW_COMMENT);
});

describe('useFeedPost (#1409)', () => {
  it('댓글은 앞뒤 공백을 떼고 보내고, 끝에 붙이며 댓글 수를 올린다', async () => {
    const { result } = await renderHook(() => useFeedPost(3), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.comments).toHaveLength(2));
    await waitFor(() => expect(result.current.post?.commentCount).toBe(2));

    await act(async () => {
      await result.current.addComment('  반가워요  ');
    });
    const [postId, input] = jest.mocked(createFeedComment).mock.calls[0];
    expect(postId).toBe(3);
    expect(input.content).toBe('반가워요');
    expect(input.clientCommentId).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(result.current.comments).toHaveLength(3));
    expect(result.current.comments[2].content).toBe('반가워요');
    await waitFor(() => expect(result.current.post?.commentCount).toBe(3));
  });

  it('댓글 재시도는 같은 clientCommentId', async () => {
    jest.mocked(createFeedComment).mockRejectedValueOnce(new Error('network'));
    const onError = jest.fn();
    const { result } = await renderHook(() => useFeedPost(3, { onError }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.post).not.toBeNull());
    await act(async () => {
      await result.current.addComment('반가워요');
    });
    expect(onError).toHaveBeenCalled();
    await act(async () => {
      await result.current.addComment('반가워요');
    });
    const [a, b] = jest.mocked(createFeedComment).mock.calls.map((c) => c[1]);
    expect(b.clientCommentId).toBe(a.clientCommentId);
  });

  it('삭제된 글(404 FEED_POST_NOT_FOUND)은 notFound', async () => {
    jest
      .mocked(fetchFeedPost)
      .mockRejectedValue(
        new ApiError(404, 'GET', '/feed/posts/3', JSON.stringify({ code: 'FEED_POST_NOT_FOUND' })),
      );
    const { result } = await renderHook(() => useFeedPost(3), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.error).toBe(false);
  });
});
