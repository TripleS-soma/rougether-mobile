import { apiGet, apiPost } from '@/api/client';
import type {
  InvitePreviewResponse,
  InviteRedeemResponse,
  MyInviteCodeResponse,
} from '@/api/types';

/**
 * 친구 초대 리워드 (#518) — 내 초대코드 조회(없으면 이 시점에 발급)와
 * 친구 코드 사용(양쪽 코인 지급, 계정당 평생 1회).
 */

/** GET /invites/me — 내 초대코드·보상 현황. */
export function fetchMyInvite() {
  return apiGet<MyInviteCodeResponse>('/invites/me');
}

/**
 * GET /invites/by-code/{code} — 사용 전 미리보기 (#1007, 서버 #343). 초대자 닉네임과
 * 받을 코인, 이미 보상을 받은 계정인지. **자동 redeem 금지 계약** — 링크·클립보드로
 * 들어온 코드는 이걸로 확인시킨 뒤에만 redeem한다. 에러코드는 redeem과 같다
 * (404 없는 코드·400 내 코드·403 봇) — 호출부가 안내로 접으므로 계측에서 뺀다.
 */
export function fetchInvitePreview(code: string) {
  return apiGet<InvitePreviewResponse>(`/invites/by-code/${encodeURIComponent(code)}`, {
    expectedStatuses: [400, 403, 404],
  });
}

/**
 * POST /invites/redeem — 받은 초대코드 사용. 404는 "그런 코드 없음"으로 화면이
 * 안내하는 정상 경로라 `api_error` 계측에서 뺀다 (#1010) — 오타 한 번이 장애
 * 통계를 덮지 않게.
 */
export function redeemInvite(code: string) {
  // 404 = 없는 코드, 409 = 이미 사용(INVITE_ALREADY_REDEEMED) — 둘 다 호출부가 안내로 접는다.
  return apiPost<InviteRedeemResponse>(
    '/invites/redeem',
    { code },
    { expectedStatuses: [404, 409] },
  );
}
