/** Room (my room) + furniture-slot + guestbook endpoints. */
import { apiGet, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type { GuestbookCreateResponse, GuestbookListResponse, RoomResponse } from './types';

/** RoomResponse + 자유 배치 필드(#327) — 다음 gen:api-types 때 types.ts로 흡수. */
export type RoomWithLayout = RoomResponse & {
  layoutFormat?: 'SLOT_V1' | 'FREE_V1';
  layoutRevision?: number;
  placements?: RoomPlacementWire[];
};

/** GET /rooms/me — the user's room: character, placed slots/placements, streak. */
export function fetchMyRoom() {
  return apiGet<RoomWithLayout>('/rooms/me');
}

/** One slot assignment; null userItemId clears the slot server-side. */
export type RoomSlotSave = { slotType: string; userItemId: number | null };

/** PUT /rooms/me/slots — save the full slot layout (null entries clear). */
export function updateRoomSlots(slots: RoomSlotSave[]) {
  return apiPut<RoomResponse>('/rooms/me/slots', { slots });
}

// 자유 배치(FREE_V1, #327) 와이어 타입 — 스웨거 PlacementItem/RoomLayoutUpdateRequest
// (다음 gen:api-types 때 types.ts로 흡수). 좌표는 방 렌더 영역 기준 0.0~1.0 정규화.
export type RoomPlacementSave = {
  userItemId: number;
  positionX: number;
  positionY: number;
  zIndex?: number;
  scale?: number;
  rotationDeg?: number;
  flipped?: boolean;
};

/** RoomResponse.placements 항목 (FREE_V1 방 조회) — assetKey로 카탈로그와 잇는다. */
export type RoomPlacementWire = {
  userItemId?: number;
  assetKey?: string;
  positionX?: number;
  positionY?: number;
  zIndex?: number;
  scale?: number;
  rotationDeg?: number;
  flipped?: boolean;
};

/**
 * PUT /rooms/me/layout — 자유 배치 저장. placements는 전체 교체, surfaceSlots는
 * 부분 갱신(null=슬롯 비우기). 첫 저장 시 SLOT_V1→FREE_V1 전환(비가역 — 이후 구
 * 슬롯 API는 409). baseRevision은 조회의 layoutRevision — 다르면 409
 * ROOM_LAYOUT_REVISION_CONFLICT(다른 기기 선저장).
 */
export function updateRoomLayout(body: {
  baseRevision: number;
  surfaceSlots: RoomSlotSave[];
  placements: RoomPlacementSave[];
}) {
  return apiPut<RoomWithLayout>('/rooms/me/layout', body);
}

/**
 * GET /rooms/{roomOwnerId}/guestbooks — newest first, cursor-paginated.
 * houseId is required (the house the viewer shares with the room owner).
 */
export function fetchGuestbooks(roomOwnerId: number, houseId: number, cursor?: number) {
  return apiGet<GuestbookListResponse>(
    `/rooms/${roomOwnerId}/guestbooks${buildQuery({ houseId, cursor })}`,
  );
}

/** POST /rooms/{roomOwnerId}/guestbooks — leave a note (1~500 chars). */
export function createGuestbook(roomOwnerId: number, houseId: number, content: string) {
  return apiPost<GuestbookCreateResponse>(`/rooms/${roomOwnerId}/guestbooks`, {
    houseId,
    content,
  });
}
