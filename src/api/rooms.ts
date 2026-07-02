/** Room (my room) + furniture-slot endpoints. */
import { apiGet, apiPut } from './client';
import type { RoomResponse, RoomSlotUpdateRequest } from './types';

/** GET /rooms/me — the user's room: character, placed slots, streak. */
export function fetchMyRoom() {
  return apiGet<RoomResponse>('/rooms/me');
}

/** PUT /rooms/me/slots — save the placed-furniture slot assignments. */
export function updateRoomSlots(body: RoomSlotUpdateRequest) {
  return apiPut<RoomResponse>('/rooms/me/slots', body);
}
