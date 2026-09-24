/**
 * Feed adapters (#1409) — 서버 응답의 옵셔널 필드를 화면 모델로 굳힌다. id가 없는 항목은
 * 버린다(표시·캐시 키로 쓸 수 없다).
 */
import type { FeedAuthor, FeedComment, FeedImage, FeedPost } from '@/components/screens/feed/types';
import type {
  FeedAuthorResponse,
  FeedCommentResponse,
  FeedImageResponse,
  FeedPostResponse,
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

export function toFeedPost(res: FeedPostResponse): FeedPost | null {
  if (res.postId == null) return null;
  return {
    postId: res.postId,
    author: toFeedAuthor(res.author),
    content: res.content ?? '',
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
  };
}
