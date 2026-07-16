/**
 * Miniature room previews for the 집 screen's member tiles: each member's live
 * room (`GET /houses/{houseId}/members/{membershipId}/room`) resolved against
 * the shop catalogue, keyed by membershipId. Loaded per house (cached until
 * the house changes); members whose fetch fails simply keep the plain tile.
 */
import { useCallback, useRef, useState } from 'react';

import { fetchHouseMemberRoom } from '@/api';
import { characterIdFromCode, fromFriendRoomSlots, type ShopCatalogue } from '@/api/adapters';
import type { MemberRoomPreview } from '@/components/screens/group-house-screen';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';

export function useMemberRoomPreviews() {
  const [previews, setPreviews] = useState<Record<number, MemberRoomPreview>>({});
  // One load per house — house switches replace the cache wholesale.
  const loadedHouseRef = useRef<number | null>(null);

  const load = useCallback(
    async (
      houseId: number,
      membershipIds: number[],
      catalogue: ShopCatalogue,
      catalogueReady = true,
    ) => {
      // A not-yet-loaded catalogue maps every slot to nothing — loading with it
      // would cache empty rooms for the whole house. Wait for the real one.
      if (!catalogueReady) return;
      if (loadedHouseRef.current === houseId) return;
      loadedHouseRef.current = houseId;
      setPreviews({});
      const entries = await Promise.all(
        membershipIds.map(async (membershipId) => {
          try {
            const room = await fetchHouseMemberRoom(houseId, membershipId);
            const placement = fromFriendRoomSlots(room.slots ?? [], catalogue);
            const preview: MemberRoomPreview = {
              placedFurnitureIds: placement.placedFurnitureIds,
              wallpaperId: placement.wallpaperId ?? DEFAULT_WALLPAPER_ID,
              floorId: placement.floorId,
              backgroundId: placement.backgroundId,
              characterId: characterIdFromCode(room.character?.code),
            };
            return [membershipId, preview] as const;
          } catch {
            // Soft-fail: this member's tile stays plain.
            return null;
          }
        }),
      );
      // A house switch mid-flight discards this batch.
      if (loadedHouseRef.current !== houseId) return;
      setPreviews(Object.fromEntries(entries.filter((e): e is NonNullable<typeof e> => !!e)));
    },
    [],
  );

  return { previews, load };
}
