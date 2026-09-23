/**
 * 공개 SNS 피드 (#1409) — spec `domains/feed/api.md`. 운영 경로는 `/api/v1/feed/...`
 * (`API_BASE`가 `/api/v1`까지 품는다). 목록은 cursor 페이지(`{ items, nextCursor, hasNext }`).
 */
import { Platform } from 'react-native';

import { toFeedComment, toFeedPost } from '@/api/adapters/feed';
import type { FeedComment, FeedPost } from '@/components/screens/feed/types';

import { getAccessToken, onSessionCleared, refreshSession } from './auth';
import {
  apiDelete,
  apiGet,
  apiGetPage,
  apiPatch,
  apiPost,
  apiPut,
  apiUpload,
  type Page,
} from './client';
import { API_BASE } from './config';
import { buildQuery } from './http';
import type {
  FeedCommentResponse,
  FeedCreateRequest,
  FeedImageResponse,
  FeedPostResponse,
} from './types';

/** 업로드할 사진 — RN FormData 파일 디스크립터와 같은 모양(`lib/pick-image`). */
export type FeedUploadFile = { uri: string; name: string; type: string };

/**
 * POST /feed/images — 사진 한 장(multipart `file`). **멱등하지 않다** — 응답을 받은
 * imageId를 재사용하고, 응답을 잃은 업로드는 서버 만료 정리에 맡긴다.
 */
export async function uploadFeedImage(file: FeedUploadFile): Promise<FeedImageResponse> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    // 웹 FormData는 실제 Blob이 필요 — picker의 로컬 uri를 blob으로 바꾼다(bug-reports와 같은 결).
    const blob = await (await fetch(file.uri)).blob();
    form.append('file', blob, file.name);
  } else {
    form.append('file', file as unknown as Blob);
  }
  return apiUpload<FeedImageResponse>('/feed/images', form);
}

/** DELETE /feed/images/{imageId} — 게시 전 업로드 취소(30장 한도에서 빠진다). 멱등. */
export function deleteFeedImage(imageId: number): Promise<void> {
  return apiDelete<void>(`/feed/images/${imageId}`, undefined, { expectedStatuses: [404] });
}

// --- 사진 표시 -----------------------------------------------------------------
//
// GET /feed/images/{imageId}는 Authorization 헤더가 필요해 `<Image source={{ uri }}>`로
// 주소를 직접 줄 수 없다(버그 제보 스크린샷 #736과 같은 제약). 바이트를 받아 웹은
// blob: URL, 네이티브는 data: URI로 바꾼다. 서버가 `Cache-Control: private, no-store`
// 를 주므로 **디스크 캐시는 두지 않고** 메모리 LRU만 — 로그아웃하면 비운다.

const IMAGE_CACHE_LIMIT = 60;
const imageCache = new Map<number, string>();
const imageInflight = new Map<number, Promise<string | null>>();

function revokeIfBlob(uri: string) {
  if (uri.startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(uri);
  }
}

function rememberImage(imageId: number, uri: string) {
  imageCache.delete(imageId);
  imageCache.set(imageId, uri);
  while (imageCache.size > IMAGE_CACHE_LIMIT) {
    const oldest = imageCache.keys().next().value as number;
    const evicted = imageCache.get(oldest);
    imageCache.delete(oldest);
    if (evicted) revokeIfBlob(evicted);
  }
}

/** 캐시·진행 중 요청을 비운다 — 세션 종료와 게시물 삭제 때. */
export function clearFeedImageCache(imageIds?: number[]) {
  const ids = imageIds ?? [...imageCache.keys()];
  for (const id of ids) {
    const uri = imageCache.get(id);
    if (uri) revokeIfBlob(uri);
    imageCache.delete(id);
    imageInflight.delete(id);
  }
}

onSessionCleared(() => clearFeedImageCache());

function blobToDataUri(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(blob);
  });
}

async function requestImage(imageId: number): Promise<Response | null> {
  const get = (token: string) =>
    fetch(`${API_BASE}/feed/images/${imageId}`, { headers: { Authorization: `Bearer ${token}` } });
  const token = getAccessToken();
  if (!token) return null;
  const res = await get(token);
  if (res.status !== 401) return res;
  // 만료 토큰 — client.ts와 같은 1회 갱신 후 재요청.
  if (!(await refreshSession())) return null;
  const next = getAccessToken();
  return next ? get(next) : null;
}

async function loadFeedImage(imageId: number): Promise<string | null> {
  try {
    const res = await requestImage(imageId);
    if (!res?.ok) return null;
    const blob = await res.blob();
    const uri =
      Platform.OS === 'web' && typeof URL !== 'undefined' && URL.createObjectURL
        ? URL.createObjectURL(blob)
        : await blobToDataUri(blob);
    if (uri) rememberImage(imageId, uri);
    return uri;
  } catch {
    return null;
  } finally {
    imageInflight.delete(imageId);
  }
}

/**
 * GET /feed/images/{imageId} → `<Image>`에 넣을 주소(웹 blob URL · 네이티브 data URI).
 * 실패하면 null — 사진 한 장 때문에 목록 전체가 깨지지 않게. 같은 사진의 동시 요청은 합친다.
 */
export function fetchFeedImage(imageId: number): Promise<string | null> {
  const cached = imageCache.get(imageId);
  if (cached) {
    rememberImage(imageId, cached);
    return Promise.resolve(cached);
  }
  const pending = imageInflight.get(imageId);
  if (pending) return pending;
  const next = loadFeedImage(imageId);
  imageInflight.set(imageId, next);
  return next;
}

// --- 게시물 ---------------------------------------------------------------------

function adaptPost(res: FeedPostResponse): FeedPost {
  const post = toFeedPost(res);
  if (!post) throw new Error('feed post without id');
  return post;
}

function adaptPage<T, R>(page: Page<T>, adapt: (item: T) => R | null): Page<R> {
  return { ...page, items: page.items.map(adapt).filter((x): x is R => x !== null) };
}

/** POST /feed/posts — 같은 `clientPostId`의 재시도는 원래 글을 돌려준다(201). */
export async function createFeedPost(input: FeedCreateRequest): Promise<FeedPost> {
  return adaptPost(await apiPost<FeedPostResponse>('/feed/posts', input));
}

/** GET /feed/posts — 최신 ID 내림차순. `authorId`를 주면 그 사람 글만. */
export async function fetchFeedPosts({
  cursor,
  size,
  authorId,
}: { cursor?: number; size?: number; authorId?: number } = {}): Promise<Page<FeedPost>> {
  const page = await apiGetPage<FeedPostResponse>(
    `/feed/posts${buildQuery({ cursor, size, authorId })}`,
  );
  return adaptPage(page, toFeedPost);
}

/** GET /feed/posts/{postId} — 삭제·탈퇴로 숨은 글은 404 FEED_POST_NOT_FOUND. */
export async function fetchFeedPost(postId: number): Promise<FeedPost> {
  return adaptPost(
    await apiGet<FeedPostResponse>(`/feed/posts/${postId}`, { expectedStatuses: [404] }),
  );
}

/** PATCH /feed/posts/{postId} — 본인 본문만(빈 문자열 허용). 사진은 바꿀 수 없다. */
export async function updateFeedPost(postId: number, content: string): Promise<FeedPost> {
  return adaptPost(await apiPatch<FeedPostResponse>(`/feed/posts/${postId}`, { content }));
}

/** DELETE /feed/posts/{postId} — 본인 글. 반복 호출해도 204. */
export function deleteFeedPost(postId: number): Promise<void> {
  return apiDelete<void>(`/feed/posts/${postId}`);
}

/** PUT /feed/posts/{postId}/like — 멱등. */
export function likeFeedPost(postId: number): Promise<void> {
  return apiPut<void>(`/feed/posts/${postId}/like`);
}

/** DELETE /feed/posts/{postId}/like — 멱등. */
export function unlikeFeedPost(postId: number): Promise<void> {
  return apiDelete<void>(`/feed/posts/${postId}/like`);
}

// --- 댓글 -----------------------------------------------------------------------

/** GET /feed/posts/{postId}/comments — **오래된 ID부터**, cursor는 마지막 commentId. */
export async function fetchFeedComments(
  postId: number,
  { cursor, size }: { cursor?: number; size?: number } = {},
): Promise<Page<FeedComment>> {
  const page = await apiGetPage<FeedCommentResponse>(
    `/feed/posts/${postId}/comments${buildQuery({ cursor, size })}`,
  );
  return adaptPage(page, toFeedComment);
}

/** POST /feed/posts/{postId}/comments — 같은 `clientCommentId` 재시도는 원래 댓글(201). */
export async function createFeedComment(
  postId: number,
  input: { clientCommentId: string; content: string },
): Promise<FeedComment> {
  const comment = toFeedComment(
    await apiPost<FeedCommentResponse>(`/feed/posts/${postId}/comments`, input),
  );
  if (!comment) throw new Error('feed comment without id');
  return comment;
}

/** DELETE /feed/posts/{postId}/comments/{commentId} — 본인 댓글. 멱등. */
export function deleteFeedComment(postId: number, commentId: number): Promise<void> {
  return apiDelete<void>(`/feed/posts/${postId}/comments/${commentId}`);
}
