/** House (그룹하우스) endpoints. */
import { apiDelete, apiGet, apiGetList, apiPost } from './client';
import { buildQuery } from './http';
import type {
  HouseCreateRequest,
  HouseCreateResponse,
  HouseDetailResponse,
  HouseJoinResponse,
  HouseListResponse,
  HouseMissionClaimResponse,
  HouseMissionContributeResponse,
  HouseMissionCreateRequest,
  HouseMissionResponse,
  HousePreviewResponse,
  MemberSummary,
  MissionSummary,
  MyHouseSummary,
} from './types';

/** GET /me/houses — houses the user belongs to. */
export function fetchMyHouses() {
  return apiGetList<MyHouseSummary>('/me/houses');
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

/** DELETE /houses/{id}/members/me — leave the house. */
export function leaveHouse(houseId: number) {
  return apiDelete<void>(`/houses/${houseId}/members/me`);
}

/** DELETE /houses/{id}/members/{membershipId} — kick a member (owner). */
export function kickHouseMember(houseId: number, membershipId: number) {
  return apiDelete<void>(`/houses/${houseId}/members/${membershipId}`);
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
