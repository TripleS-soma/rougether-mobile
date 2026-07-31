/**
 * Group-house data, backed by the API. Loads my houses (detail + members) on
 * mount plus the browsable list for 집 탐색, and exposes join/create/kick/leave
 * actions. Failures surface as toasts; loading/error drive the screens.
 *
 * Every action is useCallback-wrapped and the return object is useMemo'd so
 * memoized consumers (#539 memo boundaries) get stable references.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ApiError,
  ErrorCode,
  apiGet,
  cheerHouseMember,
  claimHouseMission,
  acceptHouseJoinRequest,
  contributeHouseMission,
  type HouseCheerType,
  createHouse as apiCreateHouse,
  createHouseMission,
  deleteHouseMission,
  fetchHouse,
  fetchHouseJoinRequests,
  fetchHouseMembers,
  fetchHouseMissions,
  fetchHousePreviewDetail,
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
import {
  toHouse,
  toHouseMission,
  toHousePreview,
  toHousePreviewDetail,
  toSearchHouse,
  type ShopCatalogue,
} from '@/api/adapters';
import type { HouseMissionContributeResponse } from '@/api/types';
import { useToast } from '@/components/ui/toast';
import type { House, HouseEditInput, NewHouseMission } from '@/components/screens/house-screen';
import { track } from '@/lib/analytics';
import type {
  HousePreview,
  HousePreviewDetail,
  SearchHouse,
} from '@/components/screens/house-search-screen';

export function useHouses() {
  const [houses, setHouses] = useState<House[]>([]);
  // Mission ids I contributed to today (session-scoped — the list API doesn't
  // expose per-member daily contribution, so this seeds from contribute calls).
  const [contributedMissionIds, setContributedMissionIds] = useState<Set<number>>(new Set());
  const [searchHouses, setSearchHouses] = useState<SearchHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(true);
  // 초기 로드 실패 플래그 (#549) — 빈 상태('집 없음' 가입 유도)로 위장하지
  // 않도록 화면이 에러+다시 시도를 보여준다. 재시도 성공 시 해제.
  const [error, setError] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const { show: toast } = useToast();

  // 내 셀 라벨용 닉네임 캐시 — 단일 집 갱신(#534)이 fetchMe를 반복하지 않게.
  const myNicknameRef = useRef<string | undefined>(undefined);

  /**
   * 한 집의 상세 묶음 → House 모델 (#534). 상세·멤버·미션·입주신청을 전부
   * 병렬 요청한다 — 신청 목록은 방장이 아니면 403이라 실패를 빈 배열로
   * 무시하는 것으로 역할 확인 직렬 홉을 없앤다.
   */
  const fetchHouseBundle = useCallback(async (id: number): Promise<House> => {
    const [detail, members, missions, joinRequests] = await Promise.all([
      fetchHouse(id),
      fetchHouseMembers(id),
      // Missions are additive — a failure shouldn't take the house down.
      fetchHouseMissions(id).catch(() => []),
      fetchHouseJoinRequests(id).catch(() => []),
    ]);
    return toHouse(
      detail,
      members,
      getSessionUserId(),
      myNicknameRef.current,
      missions.map(toHouseMission),
      Date.now(),
      joinRequests,
    );
  }, []);

  const reloadMyHouses = useCallback(async () => {
    // My cell shows the profile nickname when the members API has none.
    const [mine, nickname] = await Promise.all([
      fetchMyHouses(),
      fetchMe()
        .then((me) => me.nickname ?? undefined)
        .catch(() => myNicknameRef.current),
    ]);
    myNicknameRef.current = nickname;
    const detailed = await Promise.all(mine.map((h) => fetchHouseBundle(h.houseId ?? 0)));
    setHouses(detailed);
  }, [fetchHouseBundle]);

  /**
   * 영향받은 집 하나만 다시 받아 목록에 끼워넣는다 (#534) — 집 안 이벤트
   * (수락/거절·미션·강퇴 등)가 전체 리로드를 기다리며 늦게 반영되던 것을
   * 집 수와 무관한 한 묶음 요청으로 줄인다. 실패는 전체 리로드로 폴백.
   */
  const reloadHouse = useCallback(
    async (houseId: number) => {
      try {
        const fresh = await fetchHouseBundle(houseId);
        setHouses((prev) => prev.map((h) => (h.houseId === houseId ? fresh : h)));
      } catch {
        await reloadMyHouses();
      }
    },
    [fetchHouseBundle, reloadMyHouses],
  );

  const reloadSearch = useCallback(async () => {
    // excludeJoined — 본인 ACTIVE(소유 포함) 집은 서버가 걸러 준다 (#578).
    const list = await fetchHouses(0, 30, true);
    setSearchHouses((list.items ?? []).map((h, i) => toSearchHouse(h, i)));
  }, []);

  /** 내 집 목록 로드 사이클 (스피너 → 데이터 | 에러) — 초기 로드·재시도 공용. */
  const loadMyHouses = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await reloadMyHouses();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [reloadMyHouses]);

  /** 탐색 목록 로드 사이클 — 실패는 빈 검색 결과와 구분해 표시한다 (#549). */
  const loadSearch = useCallback(async () => {
    setSearchLoading(true);
    setSearchError(false);
    try {
      await reloadSearch();
    } catch {
      setSearchError(true);
    } finally {
      setSearchLoading(false);
    }
  }, [reloadSearch]);

  useEffect(() => {
    void loadMyHouses();
    void loadSearch();
  }, [loadMyHouses, loadSearch]);

  // 초대코드 오류 구분 (#549): 잘못된/만료 코드(4xx)는 null, 그 외(네트워크
  // 단절·서버 5xx)는 'network' — 화면 문구가 갈린다.
  const isInvalidCodeError = (e: unknown) =>
    e instanceof ApiError && e.status >= 400 && e.status < 500;

  /** Look up the house behind an invite code (pre-join preview); null = unknown code. */
  const previewByCode = useCallback(
    async (code: string): Promise<HousePreview | null | 'network'> => {
      try {
        return toHousePreview(await previewHouseByCode(code));
      } catch (e) {
        return isInvalidCodeError(e) ? null : 'network';
      }
    },
    [],
  );

  /** Join with an invite code; true=즉시 입주, 'pending'=방장 승인 대기 (#646). */
  const joinByCode = useCallback(
    async (code: string): Promise<boolean | 'pending' | 'network'> => {
      try {
        const res = await joinHouseByCode(code);
        // 부원 개인 코드 — 신청만 생성되고 방장 승인 후 입주가 확정된다.
        if (res.pendingApproval) return 'pending';
        toast('입주 완료!', 'success');
        await reloadMyHouses();
        return true;
      } catch (e) {
        return isInvalidCodeError(e) ? false : 'network';
      }
    },
    [toast, reloadMyHouses],
  );

  /** Request admission to a browsable house; true when the request is pending. */
  const joinHouse = useCallback(
    async (houseId: number): Promise<boolean> => {
      try {
        await requestHouseJoin(houseId);
        toast('입주 신청을 보냈어요!', 'success');
        await reloadSearch();
        return true;
      } catch (error) {
        const alreadyPending =
          error instanceof ApiError && error.code === ErrorCode.HOUSE_JOIN_REQUEST_ALREADY_PENDING;
        toast(
          alreadyPending ? '이미 입주 신청 중이에요' : '입주 신청에 실패했어요. 만석일 수 있어요.',
          'error',
        );
        return false;
      }
    },
    [toast, reloadSearch],
  );

  /** 신청 행을 목록에서 즉시 뺀다 (#534 낙관적 반영) — 실패 시 재동기화가 복원. */
  const dropJoinRequestLocally = useCallback(
    (houseId: number, requestId: number) =>
      setHouses((prev) =>
        prev.map((h) =>
          h.houseId === houseId
            ? { ...h, joinRequests: h.joinRequests?.filter((r) => r.requestId !== requestId) }
            : h,
        ),
      ),
    [],
  );

  const acceptJoinRequest = useCallback(
    async (houseId: number, requestId: number) => {
      dropJoinRequestLocally(houseId, requestId);
      try {
        await acceptHouseJoinRequest(houseId, requestId);
        toast('입주 신청을 수락했어요', 'success');
      } catch (err) {
        // 신청자가 이미 탈퇴 (서버 #240) — 서버가 신청을 거절 처리해 뒀으므로
        // 목록에서 지운 채로 두고 이유만 알린다(재동기화가 정리분을 반영).
        if (
          err instanceof ApiError &&
          err.code === ErrorCode.HOUSE_JOIN_REQUEST_APPLICANT_WITHDRAWN
        )
          toast('탈퇴한 회원의 신청이라 자동으로 정리했어요');
        else toast('입주 신청을 수락하지 못했어요. 정원을 확인해 주세요.', 'error');
      }
      // 성공(새 멤버 반영)·실패(신청 복원) 모두 해당 집만 재동기화.
      void reloadHouse(houseId);
    },
    [dropJoinRequestLocally, toast, reloadHouse],
  );

  const rejectJoinRequest = useCallback(
    async (houseId: number, requestId: number) => {
      dropJoinRequestLocally(houseId, requestId);
      try {
        await rejectHouseJoinRequest(houseId, requestId);
        toast('입주 신청을 거절했어요');
      } catch {
        toast('입주 신청을 거절하지 못했어요', 'error');
      }
      void reloadHouse(houseId);
    },
    [dropJoinRequestLocally, toast, reloadHouse],
  );

  /** Create a house; true on success (server issues the invite code). */
  const create = useCallback(
    async (input: {
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
          .filter((id): id is number => id != null)
          // 서버 제약: goalIds 최대 3개(size must be between 0 and 3) — 온보딩
          // 목표를 4개 이상 고른 계정이 그대로 보내면 400으로 생성이 막힌다.
          .slice(0, 3);
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
    },
    [toast, reloadMyHouses],
  );

  const kickMember = useCallback(
    async (houseId: number, membershipId: number) => {
      try {
        await kickHouseMember(houseId, membershipId);
        toast('멤버를 내보냈어요');
        await reloadHouse(houseId);
      } catch {
        toast('강퇴에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  /** 집 나가기(1인 방장은 집 삭제) — 성공 여부 반환 (연동 루틴 정리 판단, #338). */
  const leaveHouse = useCallback(
    async (houseId: number): Promise<boolean> => {
      try {
        await apiLeaveHouse(houseId);
        toast('집에서 나왔어요');
        await reloadMyHouses();
        return true;
      } catch {
        toast('나가기에 실패했어요', 'error');
        return false;
      }
    },
    [toast, reloadMyHouses],
  );

  const contributeMission = useCallback(
    async (houseId: number, missionId: number) => {
      try {
        const res = await contributeHouseMission(houseId, missionId);
        setContributedMissionIds((prev) => new Set(prev).add(missionId));
        toast(res.achieved ? '기여 완료! 목표를 달성했어요' : '기여했어요 (+1)', 'success');
        await reloadHouse(houseId);
      } catch (err) {
        // The server caps contributions at one per day per member.
        const already =
          err instanceof ApiError && err.code === ErrorCode.HOUSE_MISSION_ALREADY_CONTRIBUTED;
        // Already-today still means "contributed" — the card shows 기여됨.
        if (already) setContributedMissionIds((prev) => new Set(prev).add(missionId));
        toast(already ? '오늘은 이미 기여했어요. 내일 또 만나요!' : '기여에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  /**
   * 완료 응답에 실려온 서버 자동 기여 결과 반영 (#578) — contributeMission 성공
   * 처리와 동일하게 기여 마킹 + 해당 집만 재동기화(미션 currentValue 갱신).
   */
  const applyMissionContribution = useCallback(
    (res: HouseMissionContributeResponse) => {
      const missionId = res.missionId;
      if (missionId == null) return;
      setContributedMissionIds((prev) => new Set(prev).add(missionId));
      toast(res.achieved ? '기여 완료! 목표를 달성했어요' : '기여했어요 (+1)', 'success');
      const house = houses.find((h) => h.missions?.some((m) => m.id === missionId));
      if (house?.houseId != null) void reloadHouse(house.houseId);
    },
    [houses, toast, reloadHouse],
  );

  const claimMission = useCallback(
    async (houseId: number, missionId: number) => {
      try {
        const res = await claimHouseMission(houseId, missionId);
        toast(`보상 수령! 집 성장 포인트 +${res.grantedGrowthPoints ?? 0}`, 'success');
        await reloadHouse(houseId);
      } catch (err) {
        const notAchieved =
          err instanceof ApiError && err.code === ErrorCode.HOUSE_MISSION_NOT_ACHIEVED;
        toast(notAchieved ? '아직 목표를 달성하지 못했어요' : '보상 받기에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  // 탐색 카드 → 참여 전 미리보기 (#328). null이면 호출측은 모달을 열지 않는다.
  // 카탈로그를 주면 memberRooms를 실제 방 렌더 모델로 변환한다 (#386).
  const previewHouse = useCallback(
    async (houseId: number, catalogue?: ShopCatalogue): Promise<HousePreviewDetail | null> => {
      try {
        return toHousePreviewDetail(await fetchHousePreviewDetail(houseId), catalogue);
      } catch {
        toast('집 정보를 불러오지 못했어요', 'error');
        return null;
      }
    },
    [toast],
  );

  // 원탭 응원 — 성공하면 서버가 대상에게 푸시를 보낸다 (#329).
  const cheerMember = useCallback(
    async (houseId: number, membershipId: number, type: HouseCheerType) => {
      try {
        await cheerHouseMember(houseId, membershipId, type);
        toast('응원을 보냈어요! 친구에게 알림이 가요', 'success');
        track('cheer_send', { type });
      } catch (err) {
        // 같은 대상·같은 타입은 하루(KST) 1회.
        const dup = err instanceof ApiError && err.code === ErrorCode.HOUSE_CHEER_DUPLICATED;
        toast(dup ? '오늘은 이미 같은 응원을 보냈어요' : '응원 보내기에 실패했어요', 'error');
      }
    },
    [toast],
  );

  const createMission = useCallback(
    async (houseId: number, input: NewHouseMission) => {
      try {
        await createHouseMission(houseId, input);
        toast('새 미션을 만들었어요!', 'success');
        await reloadHouse(houseId);
      } catch (err) {
        // The server restricts mission creation to the OWNER (403).
        const notOwner = err instanceof ApiError && err.code === ErrorCode.HOUSE_NOT_OWNER;
        toast(notOwner ? '방장만 미션을 만들 수 있어요' : '미션 만들기에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  /** 미션 삭제 — 성공 여부 반환 (연동 루틴 정리 판단, #338). */
  const deleteMission = useCallback(
    async (houseId: number, missionId: number): Promise<boolean> => {
      try {
        await deleteHouseMission(houseId, missionId);
        toast('미션을 삭제했어요', 'success');
        await reloadHouse(houseId);
        return true;
      } catch (err) {
        // The server keeps COMPLETED missions (growth points already granted).
        const claimed =
          err instanceof ApiError && err.code === ErrorCode.HOUSE_MISSION_ALREADY_CLAIMED;
        const notOwner = err instanceof ApiError && err.code === ErrorCode.HOUSE_NOT_OWNER;
        toast(
          claimed
            ? '보상을 받은 미션은 삭제할 수 없어요'
            : notOwner
              ? '방장만 미션을 삭제할 수 있어요'
              : '미션 삭제에 실패했어요',
          'error',
        );
        return false;
      }
    },
    [toast, reloadHouse],
  );

  const updateHouse = useCallback(
    async (houseId: number, input: HouseEditInput) => {
      try {
        await apiUpdateHouse(houseId, input);
        toast('집 정보를 수정했어요', 'success');
        await reloadHouse(houseId);
      } catch {
        toast('집 정보 수정에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  const transferOwnership = useCallback(
    async (houseId: number, membershipId: number) => {
      try {
        await transferHouseOwnership(houseId, membershipId);
        toast('방장을 위임했어요', 'success');
        await reloadHouse(houseId);
      } catch {
        toast('방장 위임에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  /** 초대코드 발급/재발급 — 발급된 코드를 돌려준다(부원 개인 코드 표시용 #646). */
  const reissueInviteCode = useCallback(
    async (houseId: number): Promise<string | null> => {
      try {
        const res = await apiReissueInviteCode(houseId);
        toast('새 초대코드가 발급됐어요', 'success');
        // 소유자 공용 코드는 집 상세에 실려 온다 — 목록 갱신. 부원 개인
        // 코드는 상세에 없으므로 호출측이 반환값을 표시한다.
        await reloadHouse(houseId);
        return res.inviteCode ?? null;
      } catch {
        toast('초대코드 재발급에 실패했어요', 'error');
        return null;
      }
    },
    [toast, reloadHouse],
  );

  return useMemo(
    () => ({
      houses,
      contributedMissionIds,
      // 참여 중인 집은 서버 excludeJoined 필터가 이미 걸렀다 (#578).
      searchHouses,
      loading,
      searchLoading,
      error,
      searchError,
      /** Re-run the failed initial load (에러 상태의 다시 시도, #549). */
      retry: loadMyHouses,
      retrySearch: loadSearch,
      refreshHouses: reloadMyHouses,
      previewByCode,
      previewHouse,
      joinByCode,
      joinHouse,
      acceptJoinRequest,
      rejectJoinRequest,
      create,
      kickMember,
      leaveHouse,
      contributeMission,
      applyMissionContribution,
      cheerMember,
      claimMission,
      createMission,
      deleteMission,
      updateHouse,
      transferOwnership,
      reissueInviteCode,
    }),
    [
      houses,
      contributedMissionIds,
      searchHouses,
      loading,
      searchLoading,
      error,
      searchError,
      loadMyHouses,
      loadSearch,
      reloadMyHouses,
      previewByCode,
      previewHouse,
      joinByCode,
      joinHouse,
      acceptJoinRequest,
      rejectJoinRequest,
      create,
      kickMember,
      leaveHouse,
      contributeMission,
      applyMissionContribution,
      cheerMember,
      claimMission,
      createMission,
      deleteMission,
      updateHouse,
      transferOwnership,
      reissueInviteCode,
    ],
  );
}
