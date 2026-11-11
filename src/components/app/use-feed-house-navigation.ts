import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { getSessionUserId } from '@/api/auth';
import type { Screen } from '@/components/app/navigation';
import { useLatestRef } from '@/hooks/use-stable-value';
import { queryKeys } from '@/lib/query-keys';

type HouseDestination = { houseId?: number };

export function useFeedHouseNavigation(options: {
  houses: readonly HouseDestination[];
  screen: Screen;
  refreshHouses: () => Promise<unknown>;
  setHouseIndex: (index: number) => void;
  setScreen: (screen: Screen) => void;
  onMissing: () => void;
}) {
  const client = useQueryClient();
  const latest = useLatestRef(options);
  const request = useRef(0);
  return useCallback(
    async (houseId: number) => {
      const attempt = ++request.current;
      const userId = getSessionUserId();
      const origin = latest.current.screen;
      const stillCurrent = () =>
        request.current === attempt &&
        getSessionUserId() === userId &&
        latest.current.screen === origin;
      const select = () => {
        const houses =
          client.getQueryData<readonly HouseDestination[]>(queryKeys.myHouses(userId)) ??
          latest.current.houses;
        const index = houses.findIndex((house) => house.houseId === houseId);
        if (index < 0) return false;
        latest.current.setHouseIndex(index);
        latest.current.setScreen('house');
        return true;
      };
      // Select from the authoritative query cache before changing screens; never show another house first.
      if (select()) return;
      try {
        await latest.current.refreshHouses();
      } catch {
        if (stillCurrent()) latest.current.onMissing();
        return;
      }
      if (stillCurrent() && !select()) latest.current.onMissing();
    },
    [client, latest],
  );
}
