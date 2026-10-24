/**
 * Feed adapters (#1409) — 서버 응답의 옵셔널 필드를 화면 모델로 굳힌다. id가 없는 항목은
 * 버린다(표시·캐시 키로 쓸 수 없다).
 */
import type {
  FeedAuthor,
  FeedComment,
  FeedImage,
  FeedMinigameRecord,
  FeedPost,
  FeedPostRoutine,
} from '@/components/screens/feed/types';
import type {
  FeedAuthorResponse,
  FeedCommentResponse,
  FeedImageResponse,
  FeedMinigameRecordResponse,
  FeedPostResponse,
  FeedRoutineResponse,
} from '@/api/types';

function toFeedAuthor(res: FeedAuthorResponse | undefined): FeedAuthor {
  return {
    userId: res?.userId ?? 0,
    nickname: res?.nickname?.trim() ? res.nickname : null,
    profileImageKey: res?.profileImageKey ?? null,
  };
}

function toFeedImage(res: FeedImageResponse): FeedImage | null {
  if (res.imageId == null) return null;
  return { imageId: res.imageId, width: res.width ?? 0, height: res.height ?? 0 };
}

/**
 * 연결 루틴 (서버 #430) — 필드가 없거나(#430 배포 전 서버) null이거나 id·날짜가 빠졌으면
 * null(배지 없음).
 */
function toFeedPostRoutine(res: FeedRoutineResponse | null | undefined): FeedPostRoutine | null {
  if (!res || res.routineId == null || !res.date) return null;
  return { routineId: res.routineId, title: res.title ?? '', date: res.date };
}

/** 기록 카드 — 필드가 없거나(배포 전 서버) 게임·점수가 빠졌으면 null(일반 글로 그린다). */
function toFeedMinigameRecord(
  res: FeedMinigameRecordResponse | null | undefined,
): FeedMinigameRecord | null {
  if (!res || !res.gameCode || typeof res.score !== 'number') return null;
  return {
    gameCode: res.gameCode,
    score: res.score,
    rank: typeof res.rank === 'number' && res.rank > 0 ? res.rank : null,
    personalBest: res.personalBest ?? false,
    achievedAt: res.achievedAt ?? '',
  };
}

export function toFeedPost(res: FeedPostResponse): FeedPost | null {
  if (res.postId == null) return null;
  return {
    postId: res.postId,
    author: toFeedAuthor(res.author),
    // 생략·모르는 값은 서버 기본값(기존 글 = 인증게시판)으로.
    boardType: res.boardType === 'FREE' ? 'FREE' : 'VERIFICATION',
    content: res.content ?? '',
    routine: toFeedPostRoutine(res.routine),
    minigameRecord: toFeedMinigameRecord(res.minigameRecord),
    images: (res.images ?? []).map(toFeedImage).filter((i): i is FeedImage => i !== null),
    likeCount: Math.max(0, res.likeCount ?? 0),
    commentCount: Math.max(0, res.commentCount ?? 0),
    likedByMe: res.likedByMe ?? false,
    mine: res.mine ?? false,
    createdAt: res.createdAt ?? '',
    updatedAt: res.updatedAt ?? res.createdAt ?? '',
  };
}

export function toFeedComment(res: FeedCommentResponse): FeedComment | null {
  if (res.commentId == null) return null;
  return {
    commentId: res.commentId,
    postId: res.postId ?? 0,
    author: toFeedAuthor(res.author),
    content: res.content ?? '',
    mine: res.mine ?? false,
    createdAt: res.createdAt ?? '',
    parentCommentId: res.parentCommentId ?? null,
    replyToCommentId: res.replyToCommentId ?? null,
    deleted: res.deleted ?? false,
    replyCount: Math.max(0, res.replyCount ?? 0),
  };
}
