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

/** POST /invites/redeem — 받은 초대코드 사용. */
export function redeemInvite(code: string) {
  return apiPost<InviteRedeemResponse>('/invites/redeem', { code });
}
