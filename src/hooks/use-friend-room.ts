/**
 * A visited housemate's live room + today's routine list, from
 * `GET /houses/{houseId}/members/{membershipId}/room` and `…/day` (issue #149).
 * The friend's slots resolve against the shop catalogue by assetKey — their
 * userItemIds belong to their inventory, which we don't hold.
 */
import { useRef, useState } from 'react';

import {
  fetchHouseMemberDay,
  fetchHouseMemberRoom,
  fetchHouseMemberRoutineCompletions,
} from '@/api';
import {
  characterIdFromCode,
  fromFriendRoomSlots,
  type ShopCatalogue,
  toFriendActivity,
  toFriendRoutines,
} from '@/api/adapters';
import type { FriendActivityDay } from '@/components/screens/friend-room-screen';
import type { CharacterId } from '@/constants/characters';
import type { Routine } from '@/constants/routines';
import type { RoomPlacement } from '@/hooks/use-shop';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';

export type FriendRoom = {
  /** null until the room endpoint answered (renders as an empty room). */
  placement: RoomPlacement | null;
  characterId?: CharacterId;
  streakDays: number;
  routines: Routine[];
  /** Recent completion history (14 days); undefined while unloaded/failed. */
  recentActivity?: FriendActivityDay[];
  loading: boolean;
};

const EMPTY: FriendRoom = { placement: null, streakDays: 0, routines: [], loading: false };

export function useFriendRoom() {
  const [friendRoom, setFriendRoom] = useState<FriendRoom>(EMPTY);
  // Visits can be rapid (back → next friend); only the latest load may land.
  const seqRef = useRef(0);

  /** Load a member's room + day. Missing ids (demo houses) reset to empty. */
  const load = async (houseId?: number, membershipId?: number, catalogue?: ShopCatalogue) => {
    const seq = ++seqRef.current;
    if (houseId == null || membershipId == null) {
      setFriendRoom(EMPTY);
      return;
    }
    setFriendRoom({ ...EMPTY, loading: true });
    // Each endpoint fails soft so one outage doesn't blank the others' data.
    const [room, day, completions] = await Promise.all([
      fetchHouseMemberRoom(houseId, membershipId).catch(() => null),
      fetchHouseMemberDay(houseId, membershipId).catch(() => null),
      fetchHouseMemberRoutineCompletions(houseId, membershipId).catch(() => null),
    ]);
    if (seq !== seqRef.current) return;
    const resolved = room && catalogue ? fromFriendRoomSlots(room.slots ?? [], catalogue) : null;
    setFriendRoom({
      placement: resolved
        ? { ...resolved, wallpaperId: resolved.wallpaperId ?? DEFAULT_WALLPAPER_ID }
        : null,
      characterId: characterIdFromCode(room?.character?.code),
      streakDays: room?.streak?.currentCount ?? 0,
      routines: day ? toFriendRoutines(day) : [],
      // undefined on failure hides the section instead of faking an empty history.
      recentActivity: completions ? toFriendActivity(completions) : undefined,
      loading: false,
    });
  };

  return { friendRoom, load };
}
