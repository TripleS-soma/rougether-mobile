/**
 * Group-house data, backed by the API. Loads my houses (detail + members) on
 * mount plus the browsable list for 집 탐색, and exposes join/create/kick/leave
 * actions. Failures surface as toasts; loading/error drive the screens.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  createHouse as apiCreateHouse,
  fetchHouse,
  fetchHouseMembers,
  fetchGoals,
  fetchHouses,
  fetchMyHouses,
  getSessionUserId,
  joinHouse as apiJoinHouse,
  joinHouseByCode,
  kickHouseMember,
  leaveHouse as apiLeaveHouse,
} from '@/api';
import { toGroupHouse, toSearchHouse } from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import type { House } from '@/components/screens/group-house-screen';
import type { SearchHouse } from '@/components/screens/house-search-screen';

export function useHouses() {
  const [houses, setHouses] = useState<House[]>([]);
  const [searchHouses, setSearchHouses] = useState<SearchHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(true);
  const { show: toast } = useToast();

  const reloadMyHouses = useCallback(async () => {
    const mine = await fetchMyHouses();
    const myUserId = getSessionUserId();
    const detailed = await Promise.all(
      mine.map(async (h) => {
        const id = h.houseId ?? 0;
        const [detail, members] = await Promise.all([fetchHouse(id), fetchHouseMembers(id)]);
        return toGroupHouse(detail, members, myUserId);
      }),
    );
    setHouses(detailed);
  }, []);

  const reloadSearch = useCallback(async () => {
    const list = await fetchHouses(0, 30);
    setSearchHouses((list.items ?? []).map((h, i) => toSearchHouse(h, i)));
  }, []);

  useEffect(() => {
    let active = true;
    reloadMyHouses()
      .catch(() => {
        // Non-fatal; the screen shows the empty/guide state.
      })
      .finally(() => active && setLoading(false));
    reloadSearch()
      .catch(() => {})
      .finally(() => active && setSearchLoading(false));
    return () => {
      active = false;
    };
  }, [reloadMyHouses, reloadSearch]);

  /** Join with an invite code; true on success (my houses refreshed). */
  const joinByCode = async (code: string): Promise<boolean> => {
    try {
      await joinHouseByCode(code);
      toast('입주 완료!', 'success');
      await reloadMyHouses();
      return true;
    } catch {
      return false;
    }
  };

  /** Join a browsable house; true on success. */
  const joinHouse = async (houseId: string): Promise<boolean> => {
    try {
      await apiJoinHouse(Number(houseId));
      toast('입주 완료!', 'success');
      await Promise.all([reloadMyHouses(), reloadSearch()]);
      return true;
    } catch {
      toast('입주에 실패했어요. 만석이거나 이미 참여 중일 수 있어요.', 'error');
      return false;
    }
  };

  /** Create a house; true on success (server issues the invite code). */
  const create = async (input: {
    name: string;
    description?: string;
    maxMembers: number;
  }): Promise<boolean> => {
    try {
      // The API requires ≥1 goalId. Until the create screen grows a goal
      // picker, attach the first master goal; with an empty master (current
      // dev server state) creation is impossible — say so honestly.
      const goals = await fetchGoals();
      const goalIds = goals
        .map((g) => g.id)
        .filter((id): id is number => id != null)
        .slice(0, 1);
      if (goalIds.length === 0) {
        toast('목표 데이터가 아직 준비되지 않아 집을 만들 수 없어요', 'error');
        return false;
      }
      await apiCreateHouse({ ...input, goalIds });
      toast('새 집이 만들어졌어요!', 'success');
      await reloadMyHouses();
      return true;
    } catch {
      toast('집을 만들지 못했어요', 'error');
      return false;
    }
  };

  const kickMember = async (houseId: number, membershipId: number) => {
    try {
      await kickHouseMember(houseId, membershipId);
      toast('멤버를 내보냈어요');
      await reloadMyHouses();
    } catch {
      toast('강퇴에 실패했어요', 'error');
    }
  };

  const leaveHouse = async (houseId: number) => {
    try {
      await apiLeaveHouse(houseId);
      toast('집에서 나왔어요');
      await reloadMyHouses();
    } catch {
      toast('나가기에 실패했어요', 'error');
    }
  };

  return {
    houses,
    searchHouses,
    loading,
    searchLoading,
    joinByCode,
    joinHouse,
    create,
    kickMember,
    leaveHouse,
  };
}
