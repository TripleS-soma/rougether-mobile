/**
 * Group-house data, backed by the API. Loads my houses (detail + members) on
 * mount plus the browsable list for 집 탐색, and exposes join/create/kick/leave
 * actions. Failures surface as toasts; loading/error drive the screens.
 *
 * 합성 훅 — 집 탐색은 `useHouseSearch`, 공동미션은 `useHouseMissions`, 집
 * 번들 요청은 `house-bundle.ts`가 들고 있고, 이 파일은 내 집 목록 상태와
 * 그 위의 행동(입주코드·신청 처리·생성·강퇴·나가기·순서·위임)만 남긴다.
 * 소비자에게는 종전과 같은 한 객체로 돌려준다.
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
  acceptHouseJoinRequest,
  type HouseCheerType,
  createHouse as apiCreateHouse,
  fetchMe,
  fetchGoals,
  cancelMyJoinRequest,
  fetchMyHouses,
  updateHouseOrder,
  fetchMyJoinRequests,
  joinHouseByCode,
  type MyJoinRequestSummary,
  kickHouseMember,
  leaveHouse as apiLeaveHouse,
  previewHouseByCode,
  reissueInviteCode as apiReissueInviteCode,
  rejectHouseJoinRequest,
  transferHouseOwnership,
  updateHouse as apiUpdateHouse,
} from '@/api';
import { toHousePreview } from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import type { House, HouseEditInput } from '@/components/screens/house/types';
import { fetchHouseBundle } from '@/hooks/house-bundle';
import { useHouseMissions } from '@/hooks/use-house-missions';
import { useHouseSearch } from '@/hooks/use-house-search';
import { track } from '@/lib/analytics';
import type { HousePreview } from '@/components/screens/house-search-screen';

export function useHouses() {
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  // 초기 로드 실패 플래그 (#549) — 빈 상태('집 없음' 가입 유도)로 위장하지
  // 않도록 화면이 에러+다시 시도를 보여준다. 재시도 성공 시 해제.
  const [error, setError] = useState(false);
  const { show: toast } = useToast();

  // 내 셀 라벨용 닉네임 캐시 — 단일 집 갱신(#534)이 fetchMe를 반복하지 않게.
  const myNicknameRef = useRef<string | undefined>(undefined);

  /** 집 번들(house-bundle.ts)에 닉네임 캐시를 실어 보내는 얇은 래퍼. */
  const loadBundle = useCallback(
    (id: number): Promise<House> => fetchHouseBundle(id, myNicknameRef.current),
    [],
  );

  /**
   * 프로필 닉네임 변경을 내 좌석에 즉시 반영한다 (#924).
   *
   * 서버 멤버 목록은 다음 집 재조회까지 옛 닉네임을 들고 있다. 이름 하나
   * 때문에 집 전체를 다시 부르는 대신 내 좌석만 파생해 덮는다 —
   * `withMyCharacter`(use-member-room-previews)가 캐릭터에 쓰는 것과 같은 결.
   * ref도 같이 갱신해야 이후의 단건 갱신(#534)이 옛 이름으로 되돌리지 않는다.
   */
  const applyMyNickname = useCallback((nickname: string) => {
    const next = nickname || undefined;
    if (myNicknameRef.current === next) return;
    myNicknameRef.current = next;
    if (!next) return;
    setHouses((prev) => {
      let changed = false;
      const patched = prev.map((h) => ({
        ...h,
        floors: h.floors.map((f) => ({
          ...f,
          rooms: f.rooms.map((r) => {
            if (!r.isMine || r.name === next) return r;
            changed = true;
            return { ...r, name: next };
          }),
        })),
      }));
      return changed ? patched : prev;
    });
  }, []);

  // 승인 대기 중인 내 입주 신청 (#648, 서버 #255) — 집 스위처의 잠금 카드.
  const [pendingJoinRequests, setPendingJoinRequests] = useState<MyJoinRequestSummary[]>([]);

  const reloadMyHouses = useCallback(async () => {
    // My cell shows the profile nickname when the members API has none.
    const [mine, nickname, requests] = await Promise.all([
      fetchMyHouses(),
      fetchMe()
        .then((me) => me.nickname ?? undefined)
        .catch(() => myNicknameRef.current),
      // 신청 목록 실패는 조용히 — 집 목록까지 죽이지 않는다.
      fetchMyJoinRequests().catch(() => null),
    ]);
    myNicknameRef.current = nickname;
    if (requests) setPendingJoinRequests(requests.filter((r) => r.status === 'PENDING'));
    const detailed = await Promise.all(mine.map((h) => loadBundle(h.houseId ?? 0)));
    setHouses(detailed);
  }, [loadBundle]);

  /** 입주 신청 철회 (#648) — 성공 시 목록에서 즉시 제거. */
  const cancelJoinRequest = useCallback(
    async (requestId: number) => {
      try {
        await cancelMyJoinRequest(requestId);
        setPendingJoinRequests((prev) => prev.filter((r) => r.requestId !== requestId));
        toast('입주 신청을 취소했어요');
      } catch {
        toast('신청 취소에 실패했어요. 잠시 후 다시 시도해 주세요.', 'error');
      }
    },
    [toast],
  );

  /**
   * 집 순서 변경 (#820) — 인디케이터에서 끌어 놓은 결과를 서버에 저장한다.
   *
   * 낙관적으로 먼저 그린다: 손을 뗀 자리에 집이 남아 있어야 조작이 먹혔다고
   * 느낀다. 실패하면 이전 순서로 되돌리고 이유를 말한다.
   *
   * 409(HOUSE_ORDER_STALE)는 "네가 본 목록이 낡았다"는 뜻이라 되돌리는 대신
   * 전체를 다시 받는다 — 다른 기기에서 가입·탈퇴가 끼어든 경우다.
   */
  const reorderHouses = useCallback(
    async (houseIds: number[]) => {
      const before = houses;
      const byId = new Map(houses.map((h) => [h.houseId, h] as const));
      const next = houseIds.flatMap((id) => {
        const hit = byId.get(id);
        return hit ? [hit] : [];
      });
      // 서버 계약이 전량 전송이라, 우리가 가진 집을 다 못 채우면 보내지 않는다.
      if (next.length !== houses.length) return;
      setHouses(next);
      try {
        await updateHouseOrder(houseIds);
      } catch (err) {
        // HOUSE_ORDER_INVALID(400)는 "요청이 틀렸다"가 아니라 "내가 아는
        // 목록이 낡았다"는 뜻이다 (2026-08-16 실서버 확인) — 우리는 항상
        // 전량을 보내므로 부분·중복·남의 집을 보낼 방법이 없고, 서버가
        // 거부했다면 다른 기기에서 가입·탈퇴가 끼어든 것이다. 되돌리기만
        // 하면 낡은 목록이 그대로 남아 다시 시도해도 계속 실패한다.
        if (err instanceof ApiError && err.code === ErrorCode.HOUSE_ORDER_INVALID) {
          toast('집 목록이 바뀌었어요. 다시 불러올게요.');
          await reloadMyHouses().catch(() => setHouses(before));
          return;
        }
        setHouses(before);
        toast('집 순서를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
      }
    },
    [houses, reloadMyHouses, toast],
  );

  /**
   * 영향받은 집 하나만 다시 받아 목록에 끼워넣는다 (#534) — 집 안 이벤트
   * (수락/거절·미션·강퇴 등)가 전체 리로드를 기다리며 늦게 반영되던 것을
   * 집 수와 무관한 한 묶음 요청으로 줄인다. 실패는 전체 리로드로 폴백.
   */
  const reloadHouse = useCallback(
    async (houseId: number) => {
      try {
        const fresh = await loadBundle(houseId);
        setHouses((prev) => prev.map((h) => (h.houseId === houseId ? fresh : h)));
      } catch {
        await reloadMyHouses();
      }
    },
    [loadBundle, reloadMyHouses],
  );

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

  useEffect(() => {
    void loadMyHouses();
  }, [loadMyHouses]);

  // 집 탐색 — 자체 로드 사이클을 돈다. 내 집 목록과는 서버 필터로만 엮인다.
  const {
    searchHouses,
    searchHasNext,
    searchLoadingMore,
    loadMoreSearch,
    searchLoading,
    searchError,
    retrySearch,
    joinHouse,
    previewHouse,
  } = useHouseSearch();

  // 공동미션 — 변경은 그 집 하나만 재동기화(#534), 자동 기여(#578)는 houses에서 집을 찾는다.
  const {
    contributedMissionIds,
    contributeMission,
    applyMissionContribution,
    claimMission,
    createMission,
    deleteMission,
  } = useHouseMissions({ houses, reloadHouse });

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
        // 집 탭 잠금 카드(#648)에 바로 보이도록 신청 목록을 갱신한다.
        if (res.pendingApproval) {
          void fetchMyJoinRequests()
            .then((rs) => setPendingJoinRequests(rs.filter((r) => r.status === 'PENDING')))
            .catch(() => {});
          track('house_join_request', { via: 'code' });
          return 'pending';
        }
        toast('입주 완료!', 'success');
        // 소셜 진입 완료 — 리텐션 분석의 핵심 분기 (#803).
        track('house_joined', { via: 'code' });
        await reloadMyHouses();
        return true;
      } catch (e) {
        return isInvalidCodeError(e) ? false : 'network';
      }
    },
    [toast, reloadMyHouses],
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
        track('house_create');
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
      } catch (err) {
        // 봇에게 위임은 서버가 막는다 (#1013) — UI가 목록에서 빼지만 목록이
        // 낡은 사이 탭하면 도달한다. 이유 없는 실패로 두지 않는다.
        const toBot = err instanceof ApiError && err.code === ErrorCode.HOUSE_OWNER_TRANSFER_TO_BOT;
        toast(toBot ? '봇에게는 방장을 위임할 수 없어요' : '방장 위임에 실패했어요', 'error');
      }
    },
    [toast, reloadHouse],
  );

  /** 초대코드 발급/재발급 — 발급된 코드를 돌려준다(부원 개인 코드 표시용 #646). */
  const reissueInviteCode = useCallback(
    async (houseId: number): Promise<string | null> => {
      try {
        const res = await apiReissueInviteCode(houseId);
        // 확산 신호 (#803) — 코드를 새로 뽑았다는 건 누군가에게 줄 참이라는 뜻.
        track('invite_code_copy', { kind: 'house' });
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
      searchHasNext,
      searchLoadingMore,
      loadMoreSearch,
      loading,
      searchLoading,
      error,
      searchError,
      /** Re-run the failed initial load (에러 상태의 다시 시도, #549). */
      retry: loadMyHouses,
      retrySearch,
      refreshHouses: reloadMyHouses,
      applyMyNickname,
      pendingJoinRequests,
      cancelJoinRequest,
      reorderHouses,
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
      searchHasNext,
      searchLoadingMore,
      loadMoreSearch,
      loading,
      searchLoading,
      error,
      searchError,
      loadMyHouses,
      retrySearch,
      reloadMyHouses,
      applyMyNickname,
      pendingJoinRequests,
      cancelJoinRequest,
      reorderHouses,
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
