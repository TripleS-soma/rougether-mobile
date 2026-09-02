/** House (집) endpoints. */
import { apiDelete, apiGet, apiGetList, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type { RoomWithLayout } from './rooms';
import type {
  HouseCheerResponse,
  HouseCoverImage,
  HouseCreateRequest,
  HouseCreateResponse,
  HouseDetailResponse,
  HouseJoinResponse,
  InviteCodeResponse,
  HouseJoinRequestResponse,
  HouseListResponse,
  HouseOrderUpdateRequest,
  HouseMemberDayResponse,
  HouseMemberRoutineCompletionListResponse,
  HouseMissionClaimResponse,
  HouseMissionContributeResponse,
  HouseMissionCreateRequest,
  HouseMissionResponse,
  HousePreviewDetailResponse,
  HousePreviewResponse,
  HouseUpdateRequest,
  HouseUpdateResponse,
  MemberSummary,
  MissionSummary,
  RoomCobwebCleanResponse,
  MyHouseSummary,
  MyJoinRequestSummary,
  TransferOwnershipResponse,
} from './types';

/** GET /me/houses — houses the user belongs to. */
export function fetchMyHouses() {
  return apiGetList<MyHouseSummary>('/me/houses');
}

/**
 * PUT /me/houses/order — 집 탭에서 내 집이 보이는 순서를 저장한다 (#820).
 * 멤버십에 저장하는 개인 설정이라 같은 집의 다른 구성원에게는 영향이 없다.
 *
 * **성공은 204 No Content** (2026-08-16 실서버 확인) — 갱신된 목록을 돌려주지
 * 않으므로 호출부가 자기 상태를 직접 반영해야 한다.
 *
 * **전량 전송 계약**: 내가 active 구성원인 집 전체를 원하는 순서로 넘긴다.
 * 부분 목록·중복·남의 집 id는 전부 `HOUSE_ORDER_INVALID`(400)다 — 우리는
 * 항상 아는 목록 전부를 보내므로, 이 400은 사실상 "네가 아는 목록이 낡았다"는
 * 뜻이고 호출부는 재조회로 회복한다.
 */
export function updateHouseOrder(houseIds: number[]) {
  return apiPut<void>('/me/houses/order', { houseIds } as HouseOrderUpdateRequest);
}

/** GET /houses/cover-images — selectable cover catalog (집 생성·설정). */
export function fetchHouseCoverImages() {
  return apiGetList<HouseCoverImage>('/houses/cover-images');
}

/**
 * GET /houses — browse/search houses (paginated). excludeJoined=true면 본인이
 * ACTIVE(소유 포함)인 집을 서버가 걸러서 내려준다 (#578).
 */
export function fetchHouses(page = 0, size = 20, excludeJoined = false) {
  return apiGet<HouseListResponse>(
    `/houses${buildQuery({ page, size, excludeJoined: excludeJoined ? 'true' : undefined })}`,
  );
}

/** GET /houses/{id} — detail (includes inviteCode for members). */
export function fetchHouse(houseId: number) {
  return apiGet<HouseDetailResponse>(`/houses/${houseId}`);
}

/** GET /houses/{id}/members. */
export function fetchHouseMembers(houseId: number) {
  return apiGetList<MemberSummary>(`/houses/${houseId}/members`);
}

/** POST /houses — create; the server issues the invite code. */
export function createHouse(body: HouseCreateRequest) {
  return apiPost<HouseCreateResponse>('/houses', body);
}

/** GET /houses/by-code/{inviteCode} — preview before joining. */
export function previewHouseByCode(inviteCode: string) {
  return apiGet<HousePreviewResponse>(`/houses/by-code/${encodeURIComponent(inviteCode)}`);
}

/** POST /houses/join-by-code. */
export function joinHouseByCode(inviteCode: string) {
  return apiPost<HouseJoinResponse>('/houses/join-by-code', { inviteCode });
}

/** GET /me/join-requests — 내가 보낸 입주 신청 목록 (서버 #255, #648). */
export function fetchMyJoinRequests() {
  return apiGetList<MyJoinRequestSummary>('/me/join-requests');
}

/** DELETE /me/join-requests/{requestId} — 입주 신청 철회 (#648). */
export function cancelMyJoinRequest(requestId: number) {
  return apiDelete<void>(`/me/join-requests/${requestId}`);
}

/** POST /houses/{id}/join-requests — request admission to a browsable house. */
export function requestHouseJoin(houseId: number) {
  return apiPost<HouseJoinRequestResponse>(`/houses/${houseId}/join-requests`);
}

/**
 * GET /houses/{id}/join-requests — pending requests (owner only).
 *
 * 비오너의 403은 **예상된 결과**다 (#1044) — 집 로드가 상세·멤버·미션·신청을
 * 병렬로 쏘느라 역할을 미리 모르고(use-houses의 의도된 트레이드오프), 호출측이
 * 빈 배열로 접는다. api_error로 집계되면 지표만 오염되므로 출석 404(#1011)와
 * 같은 방식으로 뺀다.
 */
export function fetchHouseJoinRequests(houseId: number) {
  return apiGetList<HouseJoinRequestResponse>(`/houses/${houseId}/join-requests`, {
    expectedStatuses: [403],
  });
}

/** POST /houses/{id}/join-requests/{requestId}/accept — owner accepts. */
export function acceptHouseJoinRequest(houseId: number, requestId: number) {
  return apiPost<HouseJoinResponse>(`/houses/${houseId}/join-requests/${requestId}/accept`);
}

/** POST /houses/{id}/join-requests/{requestId}/reject — owner rejects. */
export function rejectHouseJoinRequest(houseId: number, requestId: number) {
  return apiPost<void>(`/houses/${houseId}/join-requests/${requestId}/reject`);
}

/** POST /houses/{id}/invite-code — reissue the invite code (owner). */
export function reissueInviteCode(houseId: number) {
  // 소유자=집 공용 코드(즉시가입), 부원=본인 개인 코드(승인 대기형) (#646).
  return apiPost<InviteCodeResponse>(`/houses/${houseId}/invite-code`);
}

/** PUT /houses/{id} — edit name/description/maxMembers (owner; omitted fields keep). */
export function updateHouse(houseId: number, body: HouseUpdateRequest) {
  return apiPut<HouseUpdateResponse>(`/houses/${houseId}`, body);
}

/** POST /houses/{id}/transfer-ownership — hand the OWNER role to a member. */
export function transferHouseOwnership(houseId: number, targetMembershipId: number) {
  return apiPost<TransferOwnershipResponse>(`/houses/${houseId}/transfer-ownership`, {
    targetMembershipId,
  });
}

/** DELETE /houses/{id}/members/me — leave the house. */
export function leaveHouse(houseId: number) {
  return apiDelete<void>(`/houses/${houseId}/members/me`);
}

/** DELETE /houses/{id}/members/{membershipId} — kick a member (owner). */
export function kickHouseMember(houseId: number, membershipId: number) {
  return apiDelete<void>(`/houses/${houseId}/members/${membershipId}`);
}

/** GET /houses/{id}/members/{membershipId}/room — a housemate's room (same shape as /rooms/me). */
export function fetchHouseMemberRoom(houseId: number, membershipId: number) {
  return apiGet<RoomWithLayout>(`/houses/${houseId}/members/${membershipId}/room`);
}

/**
 * POST /houses/{id}/members/{membershipId}/room/cobweb/clean — 같은 집 구성원의
 * 방에 낀 거미줄을 대신 치워주고 **청소자가** 코인 보상을 받는다 (#831, 서버 #277).
 * 방 주인에게는 `ROOM_COBWEB_CLEANED` 알림이 간다(자기 방 청소는 알림 없음).
 */
export function cleanHouseMemberCobweb(houseId: number, membershipId: number) {
  return apiPost<RoomCobwebCleanResponse>(
    `/houses/${houseId}/members/${membershipId}/room/cobweb/clean`,
  );
}

/** GET /houses/{id}/members/{membershipId}/day — that member's routines+todos on a date (default today, KST). */
export function fetchHouseMemberDay(houseId: number, membershipId: number, date?: string) {
  return apiGet<HouseMemberDayResponse>(
    `/houses/${houseId}/members/${membershipId}/day${buildQuery({ date })}`,
  );
}

/**
 * GET /houses/{id}/members/{membershipId}/routine-completions — that member's
 * completion history (HOUSE/PUBLIC categories only; default last 14 days,
 * max 92; date desc). The applied period comes back as response from/to.
 */
export function fetchHouseMemberRoutineCompletions(
  houseId: number,
  membershipId: number,
  range?: { from?: string; to?: string },
) {
  return apiGet<HouseMemberRoutineCompletionListResponse>(
    `/houses/${houseId}/members/${membershipId}/routine-completions${buildQuery({
      from: range?.from,
      to: range?.to,
    })}`,
  );
}

/** GET /houses/{id}/missions — group missions, newest first. */
export function fetchHouseMissions(houseId: number) {
  return apiGetList<MissionSummary>(`/houses/${houseId}/missions`);
}

/** POST /houses/{id}/missions — create a mission (STREAK_DAYS unsupported: 400). */
export function createHouseMission(houseId: number, body: HouseMissionCreateRequest) {
  return apiPost<HouseMissionResponse>(`/houses/${houseId}/missions`, body);
}

/** POST /houses/{id}/missions/{missionId}/contribute — add my +1 contribution. */
export function contributeHouseMission(houseId: number, missionId: number) {
  return apiPost<HouseMissionContributeResponse>(
    `/houses/${houseId}/missions/${missionId}/contribute`,
  );
}

/** POST /houses/{id}/missions/{missionId}/claim — claim the group reward (achieved only). */
export function claimHouseMission(houseId: number, missionId: number) {
  return apiPost<HouseMissionClaimResponse>(`/houses/${houseId}/missions/${missionId}/claim`);
}

/** GET /houses/{id}/preview — 참여 전 미리보기 (비구성원·강퇴 이력자 포함 조회 가능). */
export function fetchHousePreviewDetail(houseId: number) {
  return apiGet<HousePreviewDetailResponse>(`/houses/${houseId}/preview`);
}

/** 응원 3종 — 서버는 소문자 문자열로 받는다. */
export type HouseCheerType = 'great' | 'support' | 'best';

/** POST /houses/{id}/members/{membershipId}/cheer — 원탭 응원 (같은 타입 하루 1회: 409). */
export function cheerHouseMember(houseId: number, membershipId: number, type: HouseCheerType) {
  return apiPost<HouseCheerResponse>(`/houses/${houseId}/members/${membershipId}/cheer`, { type });
}

/** DELETE /houses/{id}/missions/{missionId} — OWNER only; COMPLETED missions 409. */
export function deleteHouseMission(houseId: number, missionId: number) {
  return apiDelete<void>(`/houses/${houseId}/missions/${missionId}`);
}
