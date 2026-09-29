import { API_BASE } from '@/api/config';
import {
  blockUser,
  fetchBlockedUsers,
  reportFeedComment,
  reportFeedPost,
  reportMarketAsset,
  unblockUser,
} from '@/api/moderation';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

function mockResponse(data: unknown, status = 200) {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status,
    text: async () => (data === undefined ? '' : JSON.stringify(data)),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('신고·차단 API (#1428)', () => {
  it('게시물 신고는 POST /feed/posts/{id}/reports, 빈 설명은 보내지 않는다', async () => {
    const fetchMock = mockResponse({ reportId: 12, status: 'RECEIVED' }, 201);
    await expect(reportFeedPost(3, { reason: 'SPAM', detail: '   ' })).resolves.toEqual({
      reportId: 12,
      status: 'RECEIVED',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/feed/posts/3/reports`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'SPAM' }) }),
    );
  });

  it('댓글 신고는 글·댓글 id 경로, 설명은 앞뒤 공백을 뗀다', async () => {
    const fetchMock = mockResponse({ reportId: 13, status: 'RECEIVED' }, 201);
    await reportFeedComment(3, 301, { reason: 'ABUSE', detail: '  욕설이 포함돼 있어요 ' });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/feed/posts/3/comments/301/reports`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'ABUSE', detail: '욕설이 포함돼 있어요' }),
      }),
    );
  });

  it('거래소 종목 신고는 POST /market/assets/{id}/reports', async () => {
    const fetchMock = mockResponse({ reportId: 14, status: 'RECEIVED' }, 201);
    await reportMarketAsset(11, { reason: 'COPYRIGHT' });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/market/assets/11/reports`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('차단은 PUT, 해제는 DELETE /users/{id}/block', async () => {
    const fetchMock = mockResponse(undefined, 204);
    await blockUser(8);
    await unblockUser(8);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE}/users/8/block`,
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_BASE}/users/8/block`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('차단 목록은 GET /me/blocks cursor 페이지', async () => {
    const fetchMock = mockResponse({
      items: [
        { userId: 8, nickname: '이웃', profileImageKey: null, blockedAt: '2026-09-29T03:00:00Z' },
      ],
      nextCursor: 31,
      hasNext: true,
    });
    const page = await fetchBlockedUsers({ cursor: 40, size: 20 });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/me/blocks?cursor=40&size=20`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(page.items[0].userId).toBe(8);
    expect(page.nextCursor).toBe(31);
    expect(page.hasNext).toBe(true);
  });
});
