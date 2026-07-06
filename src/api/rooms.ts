/** Room (my room) + furniture-slot + guestbook endpoints. */
import { apiGet, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type { GuestbookCreateResponse, GuestbookListResponse, RoomResponse } from './types';

/** GET /rooms/me — the user's room: character, placed slots, streak. */
export function fetchMyRoom() {
  return apiGet<RoomResponse>('/rooms/me');
}

/** One slot assignment; null userItemId clears the slot server-side. */
export type RoomSlotSave = { slotType: string; userItemId: number | null };

/** PUT /rooms/me/slots — save the full slot layout (null entries clear). */
export function updateRoomSlots(slots: RoomSlotSave[]) {
  return apiPut<RoomResponse>('/rooms/me/slots', { slots });
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
