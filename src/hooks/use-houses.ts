/**
 * Group-house data, backed by the API. Loads my houses (detail + members) on
 * mount plus the browsable list for 집 탐색, and exposes join/create/kick/leave
 * actions. Failures surface as toasts; loading/error drive the screens.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  apiGet,
  claimHouseMission,
  acceptHouseJoinRequest,
  contributeHouseMission,
  createHouse as apiCreateHouse,
  createHouseMission,
  fetchHouse,
  fetchHouseJoinRequests,
  fetchHouseMembers,
  fetchHouseMissions,
  fetchMe,
  fetchGoals,
  fetchHouses,
  fetchMyHouses,
  getSessionUserId,
  joinHouseByCode,
  kickHouseMember,
  leaveHouse as apiLeaveHouse,
  previewHouseByCode,
  reissueInviteCode as apiReissueInviteCode,
  rejectHouseJoinRequest,
  requestHouseJoin,
  transferHouseOwnership,
  updateHouse as apiUpdateHouse,
} from '@/api';
import { toGroupHouse, toHouseMission, toHousePreview, toSearchHouse } from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import type {
  House,
  HouseEditInput,
  NewHouseMission,
} from '@/components/screens/group-house-screen';
import type { HousePreview, SearchHouse } from '@/components/screens/house-search-screen';

export function useHouses() {
  const [houses, setHouses] = useState<House[]>([]);
  // Mission ids I contributed to today (session-scoped — the list API doesn't
  // expose per-member daily contribution, so this seeds from contribute calls).
  const [contributedMissionIds, setContributedMissionIds] = useState<Set<number>>(new Set());
  const [searchHouses, setSearchHouses] = useState<SearchHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(true);
  const { show: toast } = useToast();

  const reloadMyHouses = useCallback(async () => {
    const mine = await fetchMyHouses();
    const myUserId = getSessionUserId();
    // My cell shows the profile nickname when the members API has none.
    const myNickname = await fetchMe()
      .then((me) => me.nickname ?? undefined)
      .catch(() => undefined);
    const detailed = await Promise.all(
      mine.map(async (h) => {
        const id = h.houseId ?? 0;
        const detail = await fetchHouse(id);
        const [members, missions, joinRequests] = await Promise.all([
          fetchHouseMembers(id),
          // Missions are additive — a failure shouldn't take the house down.
          fetchHouseMissions(id).catch(() => []),
          detail.myRole === 'OWNER'
            ? fetchHouseJoinRequests(id).catch(() => [])
            : Promise.resolve([]),
        ]);
        return toGroupHouse(
          detail,
          members,
          myUserId,
          myNickname,
          missions.map(toHouseMission),
          joinRequests,
        );
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

  /** Look up the house behind an invite code (pre-join preview); null = unknown. */
  const previewByCode = async (code: string): Promise<HousePreview | null> => {
    try {
      return toHousePreview(await previewHouseByCode(code));
    } catch {
      return null;
    }
  };

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

  /** Request admission to a browsable house; true when the request is pending. */
  const joinHouse = async (houseId: string): Promise<boolean> => {
    try {
      await requestHouseJoin(Number(houseId));
      toast('입주 신청을 보냈어요!', 'success');
      await reloadSearch();
      return true;
    } catch (error) {
      const alreadyPending =
        error instanceof ApiError && error.bodyText?.includes('HOUSE_JOIN_REQUEST_ALREADY_PENDING');
      toast(
        alreadyPending ? '이미 입주 신청 중이에요' : '입주 신청에 실패했어요. 만석일 수 있어요.',
        'error',
      );
      return false;
    }
  };

  const acceptJoinRequest = async (houseId: number, requestId: number) => {
    try {
      await acceptHouseJoinRequest(houseId, requestId);
      toast('입주 신청을 수락했어요', 'success');
      await reloadMyHouses();
    } catch {
      toast('입주 신청을 수락하지 못했어요. 정원을 확인해 주세요.', 'error');
    }
  };

  const rejectJoinRequest = async (houseId: number, requestId: number) => {
    try {
      await rejectHouseJoinRequest(houseId, requestId);
      toast('입주 신청을 거절했어요');
      await reloadMyHouses();
    } catch {
      toast('입주 신청을 거절하지 못했어요', 'error');
    }
  };

  /** Create a house; true on success (server issues the invite code). */
  const create = async (input: {
    name: string;
    description?: string;
    maxMembers: number;
    coverImageKey?: string;
  }): Promise<boolean> => {
    try {
      // The API requires ≥1 goalId. Prefer the goals the user picked during
      // onboarding; fall back to the first master goal. With both empty
      // (current dev server state) creation is impossible — say so honestly.
      const onboarding = await apiGet<{ goals?: { goalId?: number }[] }>('/onboarding').catch(
        () => null,
      );
      let goalIds = (onboarding?.goals ?? [])
        .map((g) => g.goalId)
        .filter((id): id is number => id != null);
      if (goalIds.length === 0) {
        const goals = await fetchGoals();
        goalIds = goals
          .map((g) => g.id)
          .filter((id): id is number => id != null)
          .slice(0, 1);
      }
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

  const contributeMission = async (houseId: number, missionId: number) => {
    try {
      const res = await contributeHouseMission(houseId, missionId);
      setContributedMissionIds((prev) => new Set(prev).add(missionId));
      toast(res.achieved ? '기여 완료! 목표를 달성했어요' : '기여했어요 (+1)', 'success');
      await reloadMyHouses();
    } catch (err) {
      // The server caps contributions at one per day per member.
      const already =
        err instanceof ApiError && err.bodyText?.includes('HOUSE_MISSION_ALREADY_CONTRIBUTED');
      // Already-today still means "contributed" — the card shows 기여됨.
      if (already) setContributedMissionIds((prev) => new Set(prev).add(missionId));
      toast(already ? '오늘은 이미 기여했어요. 내일 또 만나요!' : '기여에 실패했어요', 'error');
    }
  };

  const claimMission = async (houseId: number, missionId: number) => {
    try {
      const res = await claimHouseMission(houseId, missionId);
      toast(`보상 수령! 집 성장 포인트 +${res.grantedGrowthPoints ?? 0}`, 'success');
      await reloadMyHouses();
    } catch (err) {
      const notAchieved =
        err instanceof ApiError && err.bodyText?.includes('HOUSE_MISSION_NOT_ACHIEVED');
      toast(notAchieved ? '아직 목표를 달성하지 못했어요' : '보상 받기에 실패했어요', 'error');
    }
  };

  const createMission = async (houseId: number, input: NewHouseMission) => {
    try {
      await createHouseMission(houseId, input);
      toast('새 미션을 만들었어요!', 'success');
      await reloadMyHouses();
    } catch (err) {
      // The server restricts mission creation to the OWNER (403).
      const notOwner = err instanceof ApiError && err.bodyText?.includes('HOUSE_NOT_OWNER');
      toast(notOwner ? '방장만 미션을 만들 수 있어요' : '미션 만들기에 실패했어요', 'error');
    }
  };

  const updateHouse = async (houseId: number, input: HouseEditInput) => {
    try {
      await apiUpdateHouse(houseId, input);
      toast('집 정보를 수정했어요', 'success');
      await reloadMyHouses();
    } catch {
      toast('집 정보 수정에 실패했어요', 'error');
    }
  };

  const transferOwnership = async (houseId: number, membershipId: number) => {
    try {
      await transferHouseOwnership(houseId, membershipId);
      toast('방장을 위임했어요', 'success');
      await reloadMyHouses();
    } catch {
      toast('방장 위임에 실패했어요', 'error');
    }
  };

  const reissueInviteCode = async (houseId: number) => {
    try {
      await apiReissueInviteCode(houseId);
      toast('새 초대코드가 발급됐어요', 'success');
      await reloadMyHouses();
    } catch {
      toast('초대코드 재발급에 실패했어요', 'error');
    }
  };

  // 집 탐색 hides houses the user already belongs to (the API has no joined
  // filter, and joining one again only 409s).
  const joinedIds = new Set(houses.map((h) => String(h.houseId ?? '')));
  const browsableHouses = searchHouses.filter((s) => !joinedIds.has(s.id));

  return {
    houses,
    contributedMissionIds,
    searchHouses: browsableHouses,
    loading,
    searchLoading,
    refreshHouses: reloadMyHouses,
    previewByCode,
    joinByCode,
    joinHouse,
    acceptJoinRequest,
    rejectJoinRequest,
    create,
    kickMember,
    leaveHouse,
    contributeMission,
    claimMission,
    createMission,
    updateHouse,
    transferOwnership,
    reissueInviteCode,
  };
}
