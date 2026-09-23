/**
 * 피드 화면의 앱 모델 (#1409) — 서버 응답(`FeedPostResponse` 등)은 전부 옵셔널이라
 * 어댑터(`@/api/adapters/feed`)가 여기 모양으로 굳혀 넘긴다. 화면은 이 타입만 안다.
 */
export type FeedAuthor = {
  userId: number;
  /** null 가능(탈퇴 직후 등) — 화면이 `feed.anonymous`로 대신 표시한다. */
  nickname: string | null;
  profileImageKey: string | null;
};

export type FeedImage = {
  imageId: number;
  width: number;
  height: number;
};

export type FeedPost = {
  postId: number;
  author: FeedAuthor;
  content: string;
  images: FeedImage[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  mine: boolean;
  /** ISO-8601 UTC. 표시는 기기 시간대 상대 시각. */
  createdAt: string;
  updatedAt: string;
};

export type FeedComment = {
  commentId: number;
  postId: number;
  author: FeedAuthor;
  content: string;
  mine: boolean;
  createdAt: string;
};

/**
 * 인증이 필요한 피드 사진을 표시 가능한 주소로 바꾸는 함수 — 셸이 `fetchFeedImage`를,
 * 갤러리는 픽스처를 넘긴다. 실패하면 null(자리표시로 남는다).
 */
export type FeedImageLoader = (imageId: number) => Promise<string | null>;

/** 작성 화면의 사진 한 장 — 고른 즉시 올리기 시작하고 상태를 보여 준다. */
export type FeedDraftImage = {
  /** 로컬 식별자(고른 순서) — 서버 imageId와 별개. */
  key: string;
  /** 기기 로컬 주소 — 미리보기에 그대로 쓴다. */
  uri: string;
  status: 'uploading' | 'done' | 'failed';
  /** 올리기 성공 시 서버 imageId. */
  imageId?: number;
  /** 실패 안내 문구(현지화 완료). */
  error?: string;
};
