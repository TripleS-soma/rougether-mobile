/** Room (my room) + furniture-slot endpoints. */
import { apiGet, apiPut } from './client';
import type { RoomResponse } from './types';

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
