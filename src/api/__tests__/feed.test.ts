import { API_BASE } from '@/api/config';
import {
  createFeedComment,
  createFeedPost,
  fetchFeedComments,
  fetchFeedReplies,
  fetchFeedPost,
  fetchFeedPosts,
  updateFeedPost,
} from '@/api/feed';

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

const textPost = {
  postId: 40,
  author: { userId: 7, nickname: '루틴친구', profileImageKey: null },
  boardType: 'FREE',
  content: '오늘 하루는 어땠나요?',
  images: [],
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  mine: true,
  createdAt: '2026-10-02T00:00:00Z',
  updatedAt: '2026-10-02T00:00:00Z',
};

describe('대댓글 API (#1570)', () => {
  const reply = {
    commentId: 52,
    postId: 40,
    author: { userId: 7, nickname: '나' },
    content: '나도!',
    parentCommentId: 10,
    replyToCommentId: 51,
    deleted: false,
    replyCount: 0,
  };

  it('원댓글만 요청하고, 다른 cursor로 해당 원댓글의 대댓글을 받는다', async () => {
    const fetchMock = mockResponse({ items: [reply], hasNext: true, nextCursor: 52 });
    await fetchFeedComments(40, { size: 20, topLevelOnly: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${API_BASE}/feed/posts/40/comments?size=20&topLevelOnly=true`,
      expect.anything(),
    );
    const page = await fetchFeedReplies(40, 10, { cursor: 51, size: 20 });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${API_BASE}/feed/posts/40/comments/10/replies?cursor=51&size=20`,
      expect.anything(),
    );
    expect(page).toMatchObject({ items: [reply], nextCursor: 52, hasNext: true });
  });

  it('대댓글에 답할 때 원댓글 id가 아닌 실제 대상 id를 보낸다', async () => {
    const fetchMock = mockResponse(reply, 201);
    const input = {
      clientCommentId: 'd952aff2-3a01-41bd-83bc-a7e5b9327bea',
      content: '나도!',
      replyToCommentId: 51,
    };
    await expect(createFeedComment(40, input)).resolves.toMatchObject(reply);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/feed/posts/40/comments`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('삭제된 원댓글과 구버전 응답의 기본값을 보존한다', async () => {
    mockResponse({
      items: [
        {
          commentId: 10,
          deleted: true,
          replyCount: 2,
          author: { userId: null, nickname: null, profileImageKey: null },
        },
        { commentId: 11, content: '옛 댓글' },
      ],
      hasNext: false,
    });
    const page = await fetchFeedComments(40, { topLevelOnly: true });
    expect(page.items[0]).toMatchObject({
      deleted: true,
      content: '',
      mine: false,
      replyCount: 2,
      author: { userId: 0, nickname: null },
    });
    expect(page.items[1]).toMatchObject({
      parentCommentId: null,
      replyToCommentId: null,
      deleted: false,
      replyCount: 0,
    });
  });
});

describe('피드 게시판 API (서버 #428)', () => {
  it('자유글 등록은 boardType과 빈 imageIds를 그대로 보낸다', async () => {
    const fetchMock = mockResponse(textPost, 201);
    const body = {
      clientPostId: '481e86b3-09bd-46ab-82fd-d834a1f3e7fc',
      boardType: 'FREE' as const,
      content: '오늘 하루는 어땠나요?',
      imageIds: [],
    };
    const post = await createFeedPost(body);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/feed/posts`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
    expect(post).toMatchObject({ postId: 40, boardType: 'FREE', images: [] });
  });

  it('게시판 목록은 boardType 쿼리, 통합 피드는 boardType 없이', async () => {
    const fetchMock = mockResponse({ items: [textPost], hasNext: false, nextCursor: null });
    await fetchFeedPosts({ size: 20, boardType: 'FREE' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${API_BASE}/feed/posts?size=20&boardType=FREE`,
      expect.anything(),
    );
    await fetchFeedPosts({ cursor: 100, size: 20, boardType: 'VERIFICATION' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${API_BASE}/feed/posts?cursor=100&size=20&boardType=VERIFICATION`,
      expect.anything(),
    );
    await fetchFeedPosts({ size: 20 });
    expect(fetchMock).toHaveBeenLastCalledWith(`${API_BASE}/feed/posts?size=20`, expect.anything());
  });

  it('boardType이 없거나 모르는 값인 옛 응답은 인증게시판으로 읽는다', async () => {
    const legacy: Partial<typeof textPost> = { ...textPost };
    delete legacy.boardType;
    mockResponse({ ...legacy, images: [{ imageId: 1, width: 10, height: 10 }] });
    await expect(fetchFeedPost(40)).resolves.toMatchObject({ boardType: 'VERIFICATION' });
    mockResponse({ ...textPost, boardType: 'UNKNOWN' });
    await expect(fetchFeedPost(40)).resolves.toMatchObject({ boardType: 'VERIFICATION' });
  });
});

describe('인증글 루틴 완료 연결 (서버 #430)', () => {
  const verified = {
    ...textPost,
    boardType: 'VERIFICATION',
    images: [{ imageId: 21, width: 1200, height: 1600 }],
    routine: { routineId: 15, title: '아침 스트레칭', date: '2026-10-04' },
  };

  it('응답의 routine을 배지 모델로 옮긴다', async () => {
    mockResponse(verified);
    await expect(fetchFeedPost(40)).resolves.toMatchObject({
      routine: { routineId: 15, title: '아침 스트레칭', date: '2026-10-04' },
    });
  });

  it('routine 필드가 없거나(#430 배포 전) null·불완전하면 null', async () => {
    const legacy: Partial<typeof verified> = { ...verified };
    delete legacy.routine;
    mockResponse(legacy);
    await expect(fetchFeedPost(40)).resolves.toMatchObject({ routine: null });
    mockResponse({ ...verified, routine: null });
    await expect(fetchFeedPost(40)).resolves.toMatchObject({ routine: null });
    mockResponse({ ...verified, routine: { title: '아침 스트레칭', date: '2026-10-04' } });
    await expect(fetchFeedPost(40)).resolves.toMatchObject({ routine: null });
  });

  it('인증글 등록은 routineCompletion을 함께 보낸다', async () => {
    const fetchMock = mockResponse(verified, 201);
    const body = {
      clientPostId: '481e86b3-09bd-46ab-82fd-d834a1f3e7fc',
      boardType: 'VERIFICATION' as const,
      imageIds: [21],
      routineCompletion: { routineId: 15, date: '2026-10-04' },
    };
    await createFeedPost(body);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/feed/posts`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });

  it('수정은 받은 필드만 PATCH로 보낸다', async () => {
    const fetchMock = mockResponse({ ...verified, boardType: 'FREE', routine: null });
    await updateFeedPost(40, { content: '본문', boardType: 'FREE' });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/feed/posts/40`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: '본문', boardType: 'FREE' }),
      }),
    );
  });
});

describe('미니게임 기록 카드 (서버 feat/feed-minigame-record)', () => {
  const recordPost = {
    ...textPost,
    content: '🐱 고양이 탑 쌓기 1,240점, 전체 3위 달성!',
    minigameRecord: {
      gameCode: 'cat-tower',
      score: 1240,
      rank: 3,
      personalBest: true,
      achievedAt: '2026-10-14T03:00:00Z',
    },
  };

  it('응답의 minigameRecord를 카드 모델로 옮긴다', async () => {
    mockResponse(recordPost);
    await expect(fetchFeedPost(40)).resolves.toMatchObject({
      minigameRecord: {
        gameCode: 'cat-tower',
        score: 1240,
        rank: 3,
        personalBest: true,
        achievedAt: '2026-10-14T03:00:00Z',
      },
    });
  });

  it('rank가 null이면 순위 없음, 필드가 없거나 불완전하면 기록 없는 글', async () => {
    mockResponse({ ...recordPost, minigameRecord: { ...recordPost.minigameRecord, rank: null } });
    await expect(fetchFeedPost(40)).resolves.toMatchObject({
      minigameRecord: { score: 1240, rank: null },
    });
    mockResponse(textPost);
    await expect(fetchFeedPost(40)).resolves.toMatchObject({ minigameRecord: null });
    mockResponse({ ...recordPost, minigameRecord: { gameCode: 'cat-tower' } });
    await expect(fetchFeedPost(40)).resolves.toMatchObject({ minigameRecord: null });
  });

  it('기록 글 등록은 minigameRecord.runId를 함께 보낸다', async () => {
    const fetchMock = mockResponse(recordPost, 201);
    const body = {
      clientPostId: '481e86b3-09bd-46ab-82fd-d834a1f3e7fc',
      boardType: 'FREE' as const,
      content: recordPost.content,
      imageIds: [],
      minigameRecord: { runId: 'run-77' },
    };
    await createFeedPost(body);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/feed/posts`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });
});
