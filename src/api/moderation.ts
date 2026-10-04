/**
 * 콘텐츠 신고·사용자 차단 (#1428) — spec `domains/feed/api.md` "신고·차단",
 * `domains/market/api.md` "신고"(서버 #399). 운영 경로는 `/api/v1/...`(`API_BASE`가 품는다).
 *
 * - 신고는 멱등이다: 같은 대상을 다시 신고하면 처음 신고를 201로 돌려준다(사유·설명은 처음 값).
 * - 차단은 한 방향이며 PUT/DELETE 모두 멱등 204다. 목록은 피드와 같은 cursor Page이고
 *   `nextCursor`는 차단 기록 id(회원 id 아님)다.
 */
import { REPORT_DETAIL_MAX } from '@/constants/moderation';

import { apiDelete, apiGetPage, apiPost, apiPut, type Page } from './client';
import { buildQuery } from './http';
import type {
  BlockedUserResponse,
  ContentReportRequest,
  ContentReportResponse,
  ReportReason,
} from './types';

/** 신고 입력 — `detail`은 선택(최대 500자, 빈 문자열은 보내지 않는다). */
export type ReportInput = { reason: ReportReason; detail?: string };

function reportBody({ reason, detail }: ReportInput): ContentReportRequest {
  const trimmed = detail?.trim();
  return trimmed ? { reason, detail: trimmed.slice(0, REPORT_DETAIL_MAX) } : { reason };
}

// 400 REPORT_SELF_TARGET·404(대상 없음)는 호출부가 안내로 접는 정상 경로 — 계측에서 뺀다.
const REPORT_EXPECTED = { expectedStatuses: [400, 404] };

/** POST /feed/posts/{postId}/reports — 게시물 신고. */
export function reportFeedPost(postId: number, input: ReportInput): Promise<ContentReportResponse> {
  return apiPost<ContentReportResponse>(
    `/feed/posts/${postId}/reports`,
    reportBody(input),
    REPORT_EXPECTED,
  );
}

/** POST /feed/posts/{postId}/comments/{commentId}/reports — 댓글 신고. */
export function reportFeedComment(
  postId: number,
  commentId: number,
  input: ReportInput,
): Promise<ContentReportResponse> {
  return apiPost<ContentReportResponse>(
    `/feed/posts/${postId}/comments/${commentId}/reports`,
    reportBody(input),
    REPORT_EXPECTED,
  );
}

/** POST /market/assets/{assetId}/reports — 거래소 종목(AI 사진 가구) 신고. */
export function reportMarketAsset(
  assetId: number,
  input: ReportInput,
): Promise<ContentReportResponse> {
  return apiPost<ContentReportResponse>(
    `/market/assets/${assetId}/reports`,
    reportBody(input),
    REPORT_EXPECTED,
  );
}

/** PUT /users/{userId}/block — 차단. 이미 차단했어도 204. 나 자신은 400 BLOCK_SELF. */
export function blockUser(userId: number): Promise<void> {
  return apiPut<void>(`/users/${userId}/block`, undefined, { expectedStatuses: [400, 404] });
}

/** DELETE /users/{userId}/block — 차단 해제. 차단하지 않았거나 상대가 탈퇴했어도 204. */
export function unblockUser(userId: number): Promise<void> {
  return apiDelete<void>(`/users/${userId}/block`, undefined, { expectedStatuses: [400] });
}

/** GET /me/blocks — 최근에 차단한 순서. `size` 1–50(기본 20). */
export function fetchBlockedUsers({
  cursor,
  size,
}: { cursor?: number; size?: number } = {}): Promise<Page<BlockedUserResponse>> {
  return apiGetPage<BlockedUserResponse>(`/me/blocks${buildQuery({ cursor, size })}`);
}
