import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/http';
import {
  blockUser,
  fetchBlockedUsers,
  reportFeedComment,
  reportFeedPost,
  reportMarketAsset,
  unblockUser,
} from '@/api/moderation';
import type { FeedPostPages } from '@/hooks/feed-cache';
import { useBlockedUsers, useModeration } from '@/hooks/use-moderation';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import { DEMO_FEED_POSTS } from '@/mocks/fixtures';
import { type QueryClient } from '@tanstack/react-query';

import { createTestQueryClient, queryWrapper as baseWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/moderation', () => ({
  reportFeedPost: jest.fn(),
  reportFeedComment: jest.fn(),
  reportMarketAsset: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  fetchBlockedUsers: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

// 캐시 gc 타이머(5분)가 워커를 붙잡지 않게 테스트마다 비운다.
const clients: QueryClient[] = [];
function queryWrapper(client = createTestQueryClient()) {
  clients.push(client);
  return baseWrapper(client);
}
afterEach(() => {
  clients.splice(0).forEach((c) => c.clear());
});

const apiError = (status: number, code: string) =>
  new ApiError(status, 'POST', '/x', JSON.stringify({ code }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(reportFeedPost).mockResolvedValue({ reportId: 1, status: 'RECEIVED' });
  jest.mocked(reportFeedComment).mockResolvedValue({ reportId: 2, status: 'RECEIVED' });
  jest.mocked(reportMarketAsset).mockResolvedValue({ reportId: 3, status: 'RECEIVED' });
  jest.mocked(blockUser).mockResolvedValue(undefined);
  jest.mocked(unblockUser).mockResolvedValue(undefined);
});

describe('useModeration (#1428)', () => {
  it('대상 종류별로 알맞은 신고 API를 부르고 계측한다', async () => {
    const { result } = await renderHook(() => useModeration(), { wrapper: queryWrapper() });
    await act(async () => {
      expect(await result.current.report({ kind: 'post', postId: 3 }, 'SPAM')).toBe(true);
      await result.current.report({ kind: 'comment', postId: 3, commentId: 301 }, 'ABUSE', '욕');
      await result.current.report({ kind: 'asset', assetId: 11 }, 'COPYRIGHT');
    });
    expect(reportFeedPost).toHaveBeenCalledWith(3, { reason: 'SPAM', detail: undefined });
    expect(reportFeedComment).toHaveBeenCalledWith(3, 301, { reason: 'ABUSE', detail: '욕' });
    expect(reportMarketAsset).toHaveBeenCalledWith(11, { reason: 'COPYRIGHT', detail: undefined });
    expect(track).toHaveBeenCalledWith('content_report', { target: 'post', reason: 'SPAM' });
  });

  it('내 콘텐츠 신고(REPORT_SELF_TARGET)는 전용 안내, 그 밖은 일반 실패', async () => {
    const onError = jest.fn();
    jest
      .mocked(reportFeedPost)
      .mockRejectedValueOnce(apiError(400, 'REPORT_SELF_TARGET'))
      .mockRejectedValueOnce(new Error('network'));
    const { result } = await renderHook(() => useModeration({ onError }), {
      wrapper: queryWrapper(),
    });
    await act(async () => {
      expect(await result.current.report({ kind: 'post', postId: 3 }, 'SPAM')).toBe(false);
      expect(await result.current.report({ kind: 'post', postId: 3 }, 'SPAM')).toBe(false);
    });
    expect(onError).toHaveBeenNthCalledWith(1, '내가 올린 콘텐츠는 신고할 수 없어요.');
    expect(onError).toHaveBeenNthCalledWith(
      2,
      '신고를 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(track).not.toHaveBeenCalled();
  });

  it('차단하면 그 작성자 글을 목록 캐시에서 지우고 피드·차단 목록을 무효화한다', async () => {
    const client = createTestQueryClient();
    const [other, mine] = DEMO_FEED_POSTS;
    const listKey = queryKeys.feed.list(undefined, null);
    client.setQueryData<FeedPostPages>(listKey, {
      pages: [{ items: [other, mine], hasNext: false }],
      pageParams: [undefined],
    });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useModeration(), {
      wrapper: queryWrapper(client),
    });
    await act(async () => {
      expect(await result.current.block(other.author.userId, 'post')).toBe(true);
    });
    expect(blockUser).toHaveBeenCalledWith(other.author.userId);
    const items = client.getQueryData<FeedPostPages>(listKey)?.pages[0].items ?? [];
    expect(items.map((p) => p.postId)).toEqual([mine.postId]);
    const keys = invalidate.mock.calls.map(([f]) => f?.queryKey);
    expect(keys).toContainEqual(queryKeys.feed.all(undefined));
    expect(keys).toContainEqual(queryKeys.blockedUsers(undefined));
    expect(track).toHaveBeenCalledWith('user_block', { via: 'post' });
  });

  it('자기 자신 차단(BLOCK_SELF)은 전용 안내', async () => {
    const onError = jest.fn();
    jest.mocked(blockUser).mockRejectedValueOnce(apiError(400, 'BLOCK_SELF'));
    const { result } = await renderHook(() => useModeration({ onError }), {
      wrapper: queryWrapper(),
    });
    await act(async () => {
      expect(await result.current.block(4)).toBe(false);
    });
    expect(onError).toHaveBeenCalledWith('나 자신은 차단할 수 없어요.');
  });

  it('해제는 unblockUser를 부르고 피드·차단 목록을 무효화한다', async () => {
    const client = createTestQueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(() => useModeration(), {
      wrapper: queryWrapper(client),
    });
    await act(async () => {
      expect(await result.current.unblock(8)).toBe(true);
    });
    expect(unblockUser).toHaveBeenCalledWith(8);
    const keys = invalidate.mock.calls.map(([f]) => f?.queryKey);
    expect(keys).toContainEqual(queryKeys.feed.all(undefined));
    expect(keys).toContainEqual(queryKeys.blockedUsers(undefined));
  });

  it('돌려주는 객체는 리렌더에도 같은 참조', async () => {
    const { result, rerender } = await renderHook(() => useModeration(), {
      wrapper: queryWrapper(),
    });
    const first = result.current;
    await rerender({});
    expect(result.current).toBe(first);
  });
});

describe('useBlockedUsers (#1428)', () => {
  it('cursor 페이지를 이어 받고 id 없는 항목은 거른다', async () => {
    jest
      .mocked(fetchBlockedUsers)
      .mockResolvedValueOnce({
        items: [{ userId: 8, nickname: '이웃', blockedAt: '2026-09-29T03:00:00Z' }, {}],
        nextCursor: 31,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [{ userId: 9, nickname: null, blockedAt: '2026-09-28T03:00:00Z' }],
        hasNext: false,
      });
    const { result } = await renderHook(() => useBlockedUsers(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.users).toHaveLength(1));
    expect(result.current.users[0]).toEqual({
      userId: 8,
      nickname: '이웃',
      profileImageKey: null,
      blockedAt: '2026-09-29T03:00:00Z',
    });
    expect(result.current.hasNext).toBe(true);
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.users).toHaveLength(2));
    expect(fetchBlockedUsers).toHaveBeenLastCalledWith({ cursor: 31, size: 20 });
  });

  it('enabled=false면 요청하지 않는다', async () => {
    await renderHook(() => useBlockedUsers({ enabled: false }), { wrapper: queryWrapper() });
    expect(fetchBlockedUsers).not.toHaveBeenCalled();
  });
});
