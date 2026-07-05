/** House (그룹하우스) endpoints. */
import { apiDelete, apiGet, apiGetList, apiPost } from './client';
import { buildQuery } from './http';
import type {
  HouseCreateRequest,
  HouseCreateResponse,
  HouseDetailResponse,
  HouseJoinResponse,
  HouseListResponse,
  HousePreviewResponse,
  MemberSummary,
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
