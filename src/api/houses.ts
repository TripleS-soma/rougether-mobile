/** House (그룹하우스) endpoints. */
import { apiDelete, apiGet, apiGetList, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type { RoomWithLayout } from './rooms';
import type {
  HouseCoverImage,
  HouseCreateRequest,
  HouseCreateResponse,
  HouseDetailResponse,
  HouseJoinResponse,
  HouseListResponse,
  HouseMemberDayResponse,
  HouseMemberRoutineCompletionListResponse,
  HouseMissionClaimResponse,
  HouseMissionContributeResponse,
  HouseMissionCreateRequest,
  HouseMissionResponse,
  HousePreviewResponse,
  HouseUpdateRequest,
  HouseUpdateResponse,
  MemberSummary,
  MissionSummary,
  MyHouseSummary,
  TransferOwnershipResponse,
} from './types';

/** GET /me/houses — houses the user belongs to. */
export function fetchMyHouses() {
  return apiGetList<MyHouseSummary>('/me/houses');
}

/** GET /houses/cover-images — selectable cover catalog (집 생성·설정). */
export function fetchHouseCoverImages() {
  return apiGetList<HouseCoverImage>('/houses/cover-images');
}

/** GET /houses — browse/search houses (paginated). */
export function fetchHouses(page = 0, size = 20) {
  return apiGet<HouseListResponse>(`/houses${buildQuery({ page, size })}`);
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

/** POST /houses/{id}/join — join a browsable house directly. */
export function joinHouse(houseId: number) {
  return apiPost<HouseJoinResponse>(`/houses/${houseId}/join`);
}

/** POST /houses/{id}/invite-code — reissue the invite code (owner). */
export function reissueInviteCode(houseId: number) {
  return apiPost<HouseCreateResponse>(`/houses/${houseId}/invite-code`);
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

/** GET /houses/{id}/missions/{missionId} — detail incl. my contribution. */
export function fetchHouseMission(houseId: number, missionId: number) {
  return apiGet<HouseMissionResponse>(`/houses/${houseId}/missions/${missionId}`);
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

// 응원 타입/응답 — 스웨거 HouseCheerRequest/Response (다음 gen:api-types 때 types.ts로 흡수).
export type HouseCheerType = 'great' | 'support' | 'best';
export type HouseCheerResult = {
  cheerId?: number;
  houseId?: number;
  targetMembershipId?: number;
  targetUserId?: number;
  type?: string;
  cheerDate?: string;
};

/** POST /houses/{id}/members/{membershipId}/cheer — 원탭 응원 (같은 타입 하루 1회: 409). */
export function cheerHouseMember(houseId: number, membershipId: number, type: HouseCheerType) {
  return apiPost<HouseCheerResult>(`/houses/${houseId}/members/${membershipId}/cheer`, { type });
}

/** DELETE /houses/{id}/missions/{missionId} — OWNER only; COMPLETED missions 409. */
export function deleteHouseMission(houseId: number, missionId: number) {
  return apiDelete<void>(`/houses/${houseId}/missions/${missionId}`);
}
