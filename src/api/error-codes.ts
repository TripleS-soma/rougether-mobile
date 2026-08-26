/**
 * Server error codes the client branches on (#557) — the `code` field of the
 * JSON error body, surfaced as `ApiError.code`. Catalogue only what the app
 * actually handles; add entries as new branches appear.
 */
export const ErrorCode = {
  /** 409 — 다이아 부족 (POST /gacha 구매). */
  SHOP_INSUFFICIENT_BALANCE: 'SHOP_INSUFFICIENT_BALANCE',
  /**
   * 400 — 집 순서 요청이 내 active 집 집합과 다름 (PUT /me/houses/order, #820).
   * 부분 목록·중복·남의 집 id가 모두 이 코드다. 클라이언트는 항상 전량을
   * 보내므로 실질적으로 "내가 아는 목록이 낡았다"는 신호다.
   */
  HOUSE_ORDER_INVALID: 'HOUSE_ORDER_INVALID',
  /** 409 — 이미 청소된 거미줄 (POST /rooms/me/cobweb/clean, #830). */
  ROOM_COBWEB_NOT_ACTIVE: 'ROOM_COBWEB_NOT_ACTIVE',
  /** 409 — 다른 기기가 먼저 저장 (PUT /rooms/me/layout, #327). */
  ROOM_LAYOUT_REVISION_CONFLICT: 'ROOM_LAYOUT_REVISION_CONFLICT',
  /** 409 — 이미 입주 신청 중 (POST /houses/{id}/join-requests). */
  HOUSE_JOIN_REQUEST_ALREADY_PENDING: 'HOUSE_JOIN_REQUEST_ALREADY_PENDING',
  /**
   * 409 — 사람이 더 들어갈 수 없는 집 (POST /houses/{id}/join-requests).
   *
   * 동거 봇(서버 #309) 이후 "정원 초과"의 뜻이 좁아졌다: **봇이 차지한 자리는
   * 만석이 아니다** — 사람이 신청하면 봇이 비켜준다. 그래서 앱은 정원 수로
   * 미리 막지 않고 신청을 보낸 뒤 이 코드로 진짜 만석을 구분한다 (#948).
   */
  HOUSE_FULL: 'HOUSE_FULL',
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
  /**
   * 409 — 같은 캘린더 반복 일정을 이미 루틴으로 가져왔다 (POST /routines, #952).
   * 투두의 `TODO_EXTERNAL_DUPLICATE`와 대칭이다 — 실패가 아니라 "건너뜀"이다.
   * 서버는 지운 조합도 재등록해주지 않으므로, 사용자가 지운 일정이
   * 동기화마다 되살아나지 않는다.
   */
  ROUTINE_EXTERNAL_DUPLICATE: 'ROUTINE_EXTERNAL_DUPLICATE',
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
  /** 404 — KST 오늘 진행 중인 출석 이벤트 없음 (#851). 에러가 아니라 "없음". */
  ATTENDANCE_EVENT_NOT_FOUND: 'ATTENDANCE_EVENT_NOT_FOUND',
  /** 409 — 이미 가져온 캘린더 일정 (#844). 지운 조합도 재등록되지 않는다. */
  TODO_EXTERNAL_DUPLICATE: 'TODO_EXTERNAL_DUPLICATE',
} as const;
