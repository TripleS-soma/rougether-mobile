/**
 * Server error codes the client branches on (#557) — the `code` field of the
 * JSON error body, surfaced as `ApiError.code`. Catalogue only what the app
 * actually handles; add entries as new branches appear.
 */
export const ErrorCode = {
  /** 409 — 다이아 부족 (POST /gacha 구매). */
  SHOP_INSUFFICIENT_BALANCE: 'SHOP_INSUFFICIENT_BALANCE',
  /** 409 — 이미 청소된 거미줄 (POST /rooms/me/cobweb/clean, #830). */
  ROOM_COBWEB_NOT_ACTIVE: 'ROOM_COBWEB_NOT_ACTIVE',
  /** 409 — 다른 기기가 먼저 저장 (PUT /rooms/me/layout, #327). */
  ROOM_LAYOUT_REVISION_CONFLICT: 'ROOM_LAYOUT_REVISION_CONFLICT',
  /** 409 — 이미 입주 신청 중 (POST /houses/{id}/join-requests). */
  HOUSE_JOIN_REQUEST_ALREADY_PENDING: 'HOUSE_JOIN_REQUEST_ALREADY_PENDING',
  /** 409 — 미션 기여는 하루 1회 (POST .../missions/{id}/contribute). */
  HOUSE_MISSION_ALREADY_CONTRIBUTED: 'HOUSE_MISSION_ALREADY_CONTRIBUTED',
  /** 4xx — 목표 미달성 상태에서 보상 요청 (POST .../missions/{id}/claim). */
  HOUSE_MISSION_NOT_ACHIEVED: 'HOUSE_MISSION_NOT_ACHIEVED',
  /** 409 — 같은 대상·같은 타입 응원은 하루(KST) 1회 (#329). */
  HOUSE_CHEER_DUPLICATED: 'HOUSE_CHEER_DUPLICATED',
  /** 403 — 방장 전용 동작 (미션 생성/삭제 등). */
  HOUSE_NOT_OWNER: 'HOUSE_NOT_OWNER',
  /** 4xx — 이미 보상을 받은(COMPLETED) 미션 삭제 시도. */
  HOUSE_MISSION_ALREADY_CLAIMED: 'HOUSE_MISSION_ALREADY_CLAIMED',
  /** 409 — 살아있는 루틴이 있는 카테고리 삭제 (DELETE /categories/{id}, #517). */
  CATEGORY_IN_USE: 'CATEGORY_IN_USE',
  /**
   * 409 — 승인하려는 신청자가 이미 탈퇴함 (POST …/join-requests/{id}/accept,
   * 서버 #240). 서버가 신청을 거절 처리해 두므로 클라는 안내만 하면 된다.
   */
  HOUSE_JOIN_REQUEST_APPLICANT_WITHDRAWN: 'HOUSE_JOIN_REQUEST_APPLICANT_WITHDRAWN',
  /** 409 — 초대코드는 계정당 평생 1회 (POST /invites/redeem, #518). */
  INVITE_ALREADY_REDEEMED: 'INVITE_ALREADY_REDEEMED',
  /** 4xx — 자기 초대코드는 사용 불가 (POST /invites/redeem, #518). */
  INVITE_SELF_NOT_ALLOWED: 'INVITE_SELF_NOT_ALLOWED',
} as const;
