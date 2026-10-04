import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getSessionUserId } from '@/api/auth';
import { fetchFeedPosts, likeFeedPost, unlikeFeedPost } from '@/api/feed';
import { useFeed } from '@/hooks/use-feed';
import { DEMO_FEED_POSTS } from '@/mocks/fixtures';
import { queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/feed', () => ({
  fetchFeedPosts: jest.fn(),
  likeFeedPost: jest.fn(),
  unlikeFeedPost: jest.fn(),
  deleteFeedPost: jest.fn(),
  updateFeedPost: jest.fn(),
  clearFeedImageCache: jest.fn(),
}));

jest.mock('@/api/auth', () => ({
  ...jest.requireActual('@/api/auth'),
  getSessionUserId: jest.fn(() => 7),
}));

const page = (items = DEMO_FEED_POSTS, nextCursor?: number) => ({
  items,
  hasNext: nextCursor != null,
  nextCursor,
});

beforeEach(() => {
  jest.mocked(getSessionUserId).mockReturnValue(7);
  jest.mocked(fetchFeedPosts).mockReset().mockResolvedValue(page());
  jest.mocked(likeFeedPost).mockReset().mockResolvedValue(undefined);
  jest.mocked(unlikeFeedPost).mockReset().mockResolvedValue(undefined);
});

describe('useFeed (#1409)', () => {
  it('enabled=false면 요청하지 않는다 (피드 탭을 열기 전·FEED_ENABLED 꺼짐)', async () => {
    const { result } = await renderHook(() => useFeed({ enabled: false }), {
      wrapper: queryWrapper(),
    });
    expect(result.current.posts).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(fetchFeedPosts).not.toHaveBeenCalled();
  });

  it('좋아요는 낙관적으로 뒤집고, 성공하면 그대로 둔다', async () => {
    const { result } = await renderHook(() => useFeed(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.posts).toHaveLength(3));

    await act(async () => {
      await result.current.toggleLike(3);
    });
    expect(likeFeedPost).toHaveBeenCalledWith(3);
    await waitFor(() =>
      expect(result.current.posts[0]).toMatchObject({ likedByMe: true, likeCount: 4 }),
    );
  });

  it('좋아요 실패는 되돌리고 안내한다', async () => {
    jest.mocked(unlikeFeedPost).mockRejectedValue(new Error('offline'));
    const onError = jest.fn();
    const { result } = await renderHook(() => useFeed({ onError }), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.posts).toHaveLength(3));

    let ok = true;
    await act(async () => {
      ok = await result.current.toggleLike(2); // 이미 누른 글 — 취소 시도
    });
    expect(ok).toBe(false);
    expect(unlikeFeedPost).toHaveBeenCalledWith(2);
    await waitFor(() =>
      expect(result.current.posts[1]).toMatchObject({ likedByMe: true, likeCount: 12 }),
    );
    expect(onError).toHaveBeenCalledWith('요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
  });

  it('loadMore는 nextCursor로 이어 받는다', async () => {
    jest
      .mocked(fetchFeedPosts)
      .mockResolvedValueOnce(page(DEMO_FEED_POSTS.slice(0, 2), 2))
      .mockResolvedValueOnce(page(DEMO_FEED_POSTS.slice(2)));
    const { result } = await renderHook(() => useFeed(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.hasNext).toBe(true));

    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.posts).toHaveLength(3));
    expect(jest.mocked(fetchFeedPosts).mock.calls[1][0]).toMatchObject({ cursor: 2 });
    expect(result.current.hasNext).toBe(false);
  });

  it('게시판을 바꾸면 그 boardType으로 첫 페이지부터, 전체는 boardType 없이 (서버 #428)', async () => {
    const free = DEMO_FEED_POSTS.filter((p) => p.boardType === 'FREE');
    jest
      .mocked(fetchFeedPosts)
      .mockImplementation(async ({ boardType } = {}) =>
        page(boardType ? DEMO_FEED_POSTS.filter((p) => p.boardType === boardType) : undefined),
      );
    const { result, rerender } = await renderHook(
      ({ board }: { board: 'ALL' | 'FREE' | 'VERIFICATION' }) => useFeed({ board }),
      { wrapper: queryWrapper(), initialProps: { board: 'ALL' } },
    );
    await waitFor(() => expect(result.current.posts).toHaveLength(3));
    expect(jest.mocked(fetchFeedPosts).mock.calls[0][0]).toMatchObject({ boardType: undefined });

    await rerender({ board: 'FREE' });
    await waitFor(() => expect(result.current.posts).toEqual(free));
    expect(jest.mocked(fetchFeedPosts)).toHaveBeenLastCalledWith(
      expect.objectContaining({ boardType: 'FREE', cursor: undefined }),
    );
  });

  it('내 글은 게시판 없이 authorId=내 id로 받는다 (#1455)', async () => {
    const { result } = await renderHook(() => useFeed({ board: 'MINE' }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.posts).toHaveLength(3));
    expect(jest.mocked(fetchFeedPosts).mock.calls[0][0]).toMatchObject({
      authorId: 7,
      boardType: undefined,
    });
  });

  it('세션 id를 모르면 내 글을 요청하지 않는다 — 전체 피드로 새지 않게', async () => {
    jest.mocked(getSessionUserId).mockReturnValue(undefined);
    const { result } = await renderHook(() => useFeed({ board: 'MINE' }), {
      wrapper: queryWrapper(),
    });
    await act(async () => {});
    expect(result.current.posts).toEqual([]);
    expect(fetchFeedPosts).not.toHaveBeenCalled();
  });
});
