import type { FeedPostWire } from '../../src/api/feed';
import { BLANK_PNG, E2E_USER_ID, NOW_ISO } from './common';

type FeedPage = { items: FeedPostWire[]; nextCursor?: number; hasNext: boolean };

const post = (postId: number, content: string, imageIds: number[], mine = false) =>
  ({
    postId,
    author: {
      userId: mine ? E2E_USER_ID : 9100 + postId,
      nickname: mine ? '테스트' : `이웃 ${postId}`,
      profileImageKey: null,
    },
    content,
    images: imageIds.map((imageId) => ({
      imageId,
      width: 800,
      height: 600,
      contentType: 'image/jpeg',
    })),
    likeCount: postId % 3,
    commentCount: 0,
    likedByMe: false,
    mine,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    boardType: imageIds.length > 0 ? 'VERIFICATION' : 'FREE',
    houseId: null,
    deletable: mine,
  }) satisfies FeedPostWire;

const FIRST_POST = post(904, '오늘도 스트레칭 완료', [951], true);

/**
 * 피드 — 글 4개(사진 있는 글 2개). 상세는 어느 글을 열어도 첫 글을 돌려준다(고정 응답은 경로의
 * id를 보지 않는다) — 2단의 오른쪽 칸은 목록의 첫 글로 시작하므로 그 글이 맞게 나온다.
 */
export const FEED_FIXTURES = {
  'GET /feed/posts/:id': FIRST_POST,
  'GET /feed/posts/:id/comments': { items: [], hasNext: false },
  'GET /feed/posts': {
    items: [
      FIRST_POST,
      post(903, '산책하기 좋은 날씨', []),
      post(902, '책상 정리했어요', [952]),
      post(901, '물 마시기 일주일째', []),
    ],
    hasNext: false,
  } satisfies FeedPage,
  'GET /feed/images/:id': BLANK_PNG,
};
