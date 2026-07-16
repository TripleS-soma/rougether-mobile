import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getSessionUserId } from '@/api/auth';
import { loadRoomLayout, saveRoomLayout } from '@/lib/room-layout-store';
import type { House } from '@/components/screens/group-house-screen';
import {
  applyRoomLayout,
  layoutFromHouse,
  swapSeats as swapLayoutSeats,
  type RoomLayout,
} from '@/utils/room-layout';

/**
 * Applies each house's locally saved tile arrangement (#278) and exposes the
 * drag-and-drop swap. Layouts are device-local per viewer+house — the screen
 * receives already-arranged houses, so seat indices in onSwapSeats refer to
 * what's on screen.
 */
export function useRoomLayouts(houses: House[]) {
  // houseId → saved layout (null = loaded, nothing saved) — undefined keys load.
  const [layouts, setLayouts] = useState<Record<number, RoomLayout | null>>({});
  const loadingIds = useRef(new Set<number>());

  useEffect(() => {
    for (const house of houses) {
      const id = house.houseId;
      if (id == null || id in layouts || loadingIds.current.has(id)) continue;
      loadingIds.current.add(id);
      void loadRoomLayout(id, getSessionUserId()).then((layout) => {
        loadingIds.current.delete(id);
        setLayouts((prev) => (id in prev ? prev : { ...prev, [id]: layout }));
      });
    }
  }, [houses, layouts]);

  const arranged = useMemo(
    () =>
      houses.map((h) =>
        applyRoomLayout(h, h.houseId != null ? (layouts[h.houseId] ?? null) : null),
      ),
    [houses, layouts],
  );

  const swapSeats = useCallback(
    (houseId: number, a: number, b: number) => {
      const house = arranged.find((h) => h.houseId === houseId);
      if (!house || a === b) return;
      const next = swapLayoutSeats(layoutFromHouse(house), a, b);
      setLayouts((prev) => ({ ...prev, [houseId]: next }));
      void saveRoomLayout(houseId, next, getSessionUserId());
    },
    [arranged],
  );

  return { houses: arranged, swapSeats };
}
