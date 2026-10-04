import type { FeedBoardType } from '@/api/types';

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

export type { FeedBoardType } from '@/api/types';

/**
 * 피드 목록의 게시판 필터 — `ALL`은 통합 피드(boardType 생략), `MINE`은 내 글만
 * (`authorId`=내 id, 게시판 무관, #1455).
 */
export type FeedBoardFilter = 'ALL' | FeedBoardType | 'MINE';

/**
 * 인증글이 연결한 루틴 완료 (서버 #430) — 글의 "✓ 루틴 · 날짜 완료" 배지. 제목은 연결 시점
 * 스냅샷이라 루틴 이름을 바꿔도 그대로다. `date`는 KST 달력 날짜(`YYYY-MM-DD`).
 */
export type FeedPostRoutine = {
  routineId: number;
  title: string;
  date: string;
};

/** 인증글에 연결할 루틴 완료 하나 — 요청의 `routineCompletion`과 같은 모양. */
export type FeedRoutineCompletion = {
  routineId: number;
  date: string;
};

/** 루틴 고르기 목록의 한 줄 — 그 날짜에 완료한 루틴. */
export type FeedCompletionOption = FeedRoutineCompletion & { title: string };

/** 날짜 하나의 완료 루틴들 — 최근 날짜부터. */
export type FeedCompletionGroup = {
  date: string;
  options: FeedCompletionOption[];
};

/** 루틴 고르기의 데이터 상태 — 셸이 `useRecentRoutineCompletions`로 채워 넘긴다. */
export type FeedCompletionPicker = {
  groups: FeedCompletionGroup[];
  loading: boolean;
  error: boolean;
  onRetry?: () => void;
};

/**
 * 내 글 수정 요청 (서버 #430) — `content`는 늘 보내고, 게시판·연결 루틴은 **바뀔 때만**
 * 싣는다(생략 = 유지). 자유로 바꾸면 `routineCompletion` 없이 `boardType: 'FREE'`.
 */
export type FeedPostEdit = {
  content: string;
  boardType?: FeedBoardType;
  routineCompletion?: FeedRoutineCompletion;
};

export type FeedPost = {
  postId: number;
  author: FeedAuthor;
  /** 수정에서 자유↔인증으로 바꿀 수 있다(서버 #430). */
  boardType: FeedBoardType;
  content: string;
  /** 인증글의 연결 루틴 — 자유글·연결 없는 옛 인증글은 null. */
  routine: FeedPostRoutine | null;
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
