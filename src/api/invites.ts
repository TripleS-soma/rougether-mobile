import { apiGet, apiPost } from '@/api/client';
import type { InviteRedeemResponse, MyInviteCodeResponse } from '@/api/types';

/**
 * 친구 초대 리워드 (#518) — 내 초대코드 조회(없으면 이 시점에 발급)와
 * 친구 코드 사용(양쪽 코인 지급, 계정당 평생 1회).
 */

/** GET /invites/me — 내 초대코드·보상 현황. */
export function fetchMyInvite() {
  return apiGet<MyInviteCodeResponse>('/invites/me');
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
