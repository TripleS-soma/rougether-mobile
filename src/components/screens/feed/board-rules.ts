/**
 * 게시판별 작성 조건 (서버 #428, spec feed/features.md "게시판 구분") — 화면(버튼·안내)과
 * 훅(제출 가드)이 같은 판정을 쓰도록 한 곳에.
 *
 * - `FREE`: 사진 0–10장. 사진이 없으면 공백을 뺀 본문이 필수.
 * - `VERIFICATION`: 사진 1–10장 필수, 본문 선택.
 */
import type { FeedBoardType, FeedDraftImage } from '@/components/screens/feed/types';

/** 지금 올릴 수 없는 이유 — null이면 올릴 수 있다. */
export type FeedComposeBlocker = 'needPhoto' | 'needContent' | 'waitUpload' | 'uploadFailed';

export function feedComposeBlocker(
  board: FeedBoardType,
  images: readonly FeedDraftImage[],
  content: string,
): FeedComposeBlocker | null {
  if (images.length === 0) {
    if (board === 'VERIFICATION') return 'needPhoto';
    return content.trim() ? null : 'needContent';
  }
  if (images.some((img) => img.status === 'uploading')) return 'waitUpload';
  if (images.some((img) => img.status !== 'done' || img.imageId == null)) return 'uploadFailed';
  return null;
}

/** 이 글의 본문을 비울 수 있는가 — 사진 없는 자유글만 본문이 필수(수정 포함). */
export function feedContentRequired(board: FeedBoardType, imageCount: number): boolean {
  return board === 'FREE' && imageCount === 0;
}
