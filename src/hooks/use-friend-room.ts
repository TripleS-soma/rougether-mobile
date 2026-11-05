/**
 * A visited housemate's live room + a day's routine list, from
 * `GET /houses/{houseId}/members/{membershipId}/room` and `…/day` (issue #149).
 * 날짜별 보기 (#1423): `selectDate`로 다른 날의 `…/day?date=`를 받고, 주간 날짜 줄의
 * 완료 점은 `…/routine-completions`(최대 92일)를 날짜별 개수로 접어 둔다.
 * The friend's slots resolve against the shop catalogue by assetKey — their
 * userItemIds belong to their inventory, which we don't hold.
 */
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import {
  fetchHouseMemberDay,
  fetchHouseMemberRoutineCompletions,
  cleanHouseMemberCobweb,
  ApiError,
} from '@/api';
import {
  characterIdFromCode,
  fromFriendRoomSlots,
  fromRoomPlacements,
  toCharacterFrames,
  type ShopCatalogue,
  toFriendDoneCounts,
  toFriendCategories,
  toFriendRoutines,
} from '@/api/adapters';
import type { CharacterId } from '@/constants/characters';
import type { Routine, RoutineCategoryMeta } from '@/constants/routines';
import { DEFAULT_WALLPAPER_ID, type PlacedFurniture } from '@/resources/furniture';
import { ErrorCode } from '@/api/error-codes';
import { fetchMemberRoom, MEMBER_ROOM_STALE_MS } from '@/hooks/use-member-room-previews';
import { queryKeys } from '@/lib/query-keys';
import type { RoomCobweb } from '@/components/room/room';
import { shiftIso, todayIso } from '@/utils/datetime';

/** 완료 점 기록을 한 번에 받는 기간 — 서버 상한 92일. 첫 방문은 오늘까지 12주. */
const COMPLETION_WINDOW_DAYS = 92;
const INITIAL_COMPLETION_DAYS = 84;

/** 자유 배치 가구 — 가구의 유일한 정본 (#925). */
export type FriendRoomPlacement = {
  wallpaperId: string;
  floorId: string | null;
  backgroundId: string | null;
  placements: PlacedFurniture[];
};

export type FriendRoom = {
  /** null until the room endpoint answered (renders as an empty room). */
  placement: FriendRoomPlacement | null;
  characterId?: CharacterId;
  /** The friend's CDN animation keys (room response); local sprite fallback. */
  characterFrames?: string[];
  streakDays: number;
  /** 친구의 한 줄 소개 (2026-10-14, 서버 `ownerBio`) — 같은 집 구성원에게만 온다. */
  bio: string | null;
  /** 친구 방에 낀 거미줄 (#829). */
  cobweb: RoomCobweb | null;
  routines: Routine[];
  /** 그날 루틴·투두의 공개 카테고리 메타 (#528) — 그룹 헤더용. */
  categories: RoutineCategoryMeta[];
  /** 목록이 보여주는 날짜 "YYYY-MM-DD" (#1423). 방문하면 오늘. */
  selectedDate: string;
  /** 다른 날짜로 바꿔 그날 목록을 받는 중 — 방·방명록은 그대로 두고 목록만 로딩. */
  dayLoading: boolean;
  /** 날짜별 완료 개수 (#1423) — 주간 줄의 점. undefined면 기록을 못 받아 점을 숨긴다. */
  doneCounts?: Record<string, number>;
  /** 고른 날짜의 목록을 못 받음 — 빈 날과 구분해 안내한다. */
  dayError?: boolean;
  loading: boolean;
  /**
   * 방·루틴·기록 3요청이 전멸했을 때 true (#549) — 방문 실패를 빈 방으로
   * 위장하지 않도록 화면이 실패+다시 시도를 보여준다. 부분 실패는 기존대로
   * 성공한 데이터만 렌더한다.
   */
  error?: boolean;
};

const emptyRoom = (): FriendRoom => ({
  placement: null,
  cobweb: null,
  streakDays: 0,
  bio: null,
  routines: [],
  categories: [],
  selectedDate: todayIso(),
  dayLoading: false,
  loading: false,
});

/**
 * 친구 방 스와이프 즉시 전환 (#1635) — 오늘 목록·완료 기록도 방 응답처럼 react-query에 올린다.
 * 이웃 친구를 미리 받아 두면 넘길 때 캐시에서 바로 그려 "목록 → 스피너 → 목록" 깜빡임이 없다.
 * 신선도는 방 응답과 같은 30초 — 그보다 오래되면 캐시를 먼저 보여 주고 뒤에서 최신화한다.
 */
const memberDayQuery = (houseId: number, membershipId: number, today: string) => ({
  queryKey: queryKeys.memberDay.one(houseId, membershipId, today),
  queryFn: () => fetchHouseMemberDay(houseId, membershipId),
  staleTime: MEMBER_ROOM_STALE_MS,
  retry: false,
});

const memberCompletionsQuery = (houseId: number, membershipId: number, today: string) => {
  const from = shiftIso(today, -(INITIAL_COMPLETION_DAYS - 1));
  return {
    queryKey: queryKeys.memberCompletions.one(houseId, membershipId, from, today),
    queryFn: () => fetchHouseMemberRoutineCompletions(houseId, membershipId, { from, to: today }),
    staleTime: MEMBER_ROOM_STALE_MS,
    retry: false,
  };
};

type MemberRoomData = Awaited<ReturnType<typeof fetchMemberRoom>>;
type MemberDayData = Awaited<ReturnType<typeof fetchHouseMemberDay>>;
type MemberCompletionsData = Awaited<ReturnType<typeof fetchHouseMemberRoutineCompletions>>;

/** 캐시에 이미 있는 친구 방 응답 3종 — 오늘 목록이 없으면 즉시 표시할 수 없으므로 null. */
function cachedVisit(qc: QueryClient, houseId: number, membershipId: number, today: string) {
  const day = qc.getQueryData<MemberDayData>(memberDayQuery(houseId, membershipId, today).queryKey);
  if (day === undefined) return null;
  return {
    room: qc.getQueryData<MemberRoomData>(queryKeys.memberRoom.one(houseId, membershipId)) ?? null,
    day,
    completions:
      qc.getQueryData<MemberCompletionsData>(
        memberCompletionsQuery(houseId, membershipId, today).queryKey,
      ) ?? null,
  };
}

export function useFriendRoom() {
  const qc = useQueryClient();
  const [friendRoom, setFriendRoom] = useState<FriendRoom>(emptyRoom);
  // Visits can be rapid (back → next friend); only the latest load may land.
  const seqRef = useRef(0);
  // 날짜 전환 (#1423) — 방문 중인 멤버와, 완료 점을 어디까지 받아 뒀는지.
  const targetRef = useRef<{ houseId: number; membershipId: number } | null>(null);
  const coveredFromRef = useRef<string | null>(null);
  const daySeqRef = useRef(0);

  /**
   * Load a member's room + day. Missing ids (demo houses) reset to empty.
   * useCallback: 셸이 memo 화면(HouseScreen)의 콜백 안에 넣는다 (#539).
   */
  const load = useCallback(
    async (
      houseId?: number,
      membershipId?: number,
      catalogue?: ShopCatalogue,
      /** 마스터 `/characters` 프레임 맵 — 내 방과 같은 그림을 쓰기 위한 것 (#968). */
      masterFrames?: Partial<Record<CharacterId, string[]>>,
    ) => {
      const seq = ++seqRef.current;
      daySeqRef.current++;
      targetRef.current =
        houseId != null && membershipId != null ? { houseId, membershipId } : null;
      coveredFromRef.current = null;
      if (houseId == null || membershipId == null) {
        setFriendRoom(emptyRoom());
        return;
      }
      const today = todayIso();
      // 오늘 날짜를 바꾸는 동안(selectDate) 뒤늦게 온 방문 응답이 그 목록을 덮지 않게.
      const daySeqAtStart = daySeqRef.current;
      const compose = (
        room: MemberRoomData | null,
        day: MemberDayData | null,
        completions: MemberCompletionsData | null,
      ): FriendRoom => {
        // 표면(벽지·바닥·배경)만 슬롯에서 읽는다 — 서버가 거기 저장한다 (서버 #162).
        const resolved =
          room && catalogue ? fromFriendRoomSlots(room.slots ?? [], catalogue) : null;
        // 가구는 자유 좌표가 정본 (#925) — assetKey 기준으로 해석해 그대로 렌더.
        const friendPlacements =
          room && catalogue ? fromRoomPlacements(room.placements ?? [], catalogue) : [];
        // Same guard as toOwnedCharacter: a code the app doesn't know renders as the
        // default character, so its frames must not ride along (wrong pairing).
        const friendCharacterId = characterIdFromCode(room?.character?.code);
        return {
          placement: resolved
            ? {
                ...resolved,
                wallpaperId: resolved.wallpaperId ?? DEFAULT_WALLPAPER_ID,
                placements: friendPlacements,
              }
            : null,
          characterId: friendCharacterId,
          // 친구 방 응답에는 `poses[]`가 없다(#735 — 2026-08-24 재확인). 그래서 예전엔
          // 레거시 `animations`만 폈는데, 내 방은 `poses`를 써서 **같은 캐릭터가 두
          // 화면에서 다른 그림으로** 나왔다 (#968). 마스터 `/characters`가 주는 poses를
          // 앱이 이미 갖고 있으므로 그걸 먼저 쓰고, 못 받았을 때만 응답으로 떨어진다.
          characterFrames: friendCharacterId
            ? (masterFrames?.[friendCharacterId] ??
              toCharacterFrames(undefined, room?.character?.animations))
            : undefined,
          streakDays: room?.streak?.currentCount ?? 0,
          bio: room?.ownerBio ?? null,
          cobweb: room?.cobweb ?? null,
          routines: day ? toFriendRoutines(day) : [],
          categories: day ? toFriendCategories(day) : [],
          selectedDate: today,
          dayLoading: false,
          // undefined on failure hides the dots instead of faking an empty history.
          doneCounts: completions ? toFriendDoneCounts(completions) : undefined,
          loading: false,
        };
      };
      const coverFrom = (completions: MemberCompletionsData | null) => {
        if (completions)
          coveredFromRef.current =
            completions.from ?? shiftIso(today, -(INITIAL_COMPLETION_DAYS - 1));
      };

      // 이웃 미리 받기로 캐시에 있으면 로딩 없이 바로 그린다 (#1635) — 스와이프 깜빡임 제거.
      const cached = cachedVisit(qc, houseId, membershipId, today);
      if (cached) {
        coverFrom(cached.completions);
        setFriendRoom(compose(cached.room, cached.day, cached.completions));
      } else {
        setFriendRoom({ ...emptyRoom(), loading: true });
      }
      // Each endpoint fails soft so one outage doesn't blank the others' data.
      // 신선한 캐시면 fetchQuery가 요청 없이 그대로 돌려준다.
      const [room, day, completions] = await Promise.all([
        // 집 좌석 미리보기가 방금 받은 같은 방이면 그 응답을 쓴다 (성능 장부 N5).
        fetchMemberRoom(qc, houseId, membershipId).catch(() => null),
        qc.fetchQuery(memberDayQuery(houseId, membershipId, today)).catch(() => null),
        qc.fetchQuery(memberCompletionsQuery(houseId, membershipId, today)).catch(() => null),
      ]);
      if (seq !== seqRef.current) return;
      if (!room && !day && !completions) {
        // 캐시로 이미 그렸으면 최신화 실패는 조용히 넘긴다 — 보이던 방을 에러로 바꾸지 않는다.
        if (cached) return;
        // 3요청 전멸 = 방문 자체가 실패 — 빈 방 대신 에러 상태로 (#549).
        setFriendRoom({ ...emptyRoom(), error: true });
        return;
      }
      coverFrom(completions);
      const fresh = compose(room, day, completions);
      setFriendRoom((prev) =>
        daySeqRef.current === daySeqAtStart
          ? fresh
          : // 그사이 다른 날짜를 골랐다 — 목록·날짜는 그 선택을 지키고 방·기록만 갱신.
            {
              ...fresh,
              routines: prev.routines,
              categories: prev.categories,
              selectedDate: prev.selectedDate,
              dayLoading: prev.dayLoading,
              dayError: prev.dayError,
            },
      );
    },
    [qc],
  );

  /**
   * 목록 날짜 바꾸기 (#1423) — 그날의 `…/day?date=`를 받아 루틴·할 일만 교체한다.
   * 보고 있는 주가 받아 둔 완료 기록보다 과거면 그 앞 92일을 이어 받아 점을 채운다.
   * 빠르게 여러 날을 눌러도 마지막 선택만 반영된다. 참조 안정(#539).
   */
  const selectDate = useCallback(async (date: string) => {
    const target = targetRef.current;
    const seq = ++daySeqRef.current;
    setFriendRoom((prev) => ({ ...prev, selectedDate: date, dayLoading: target != null }));
    if (!target) return;
    const { houseId, membershipId } = target;
    const covered = coveredFromRef.current;
    const weekStart = shiftIso(date, -new Date(`${date}T12:00:00Z`).getUTCDay());
    if (covered && weekStart < covered) {
      const to = shiftIso(covered, -1);
      const from = shiftIso(covered, -COMPLETION_WINDOW_DAYS);
      coveredFromRef.current = from;
      void fetchHouseMemberRoutineCompletions(houseId, membershipId, { from, to })
        .then((more) => {
          if (targetRef.current !== target) return;
          setFriendRoom((prev) => ({
            ...prev,
            doneCounts: { ...toFriendDoneCounts(more), ...(prev.doneCounts ?? {}) },
          }));
        })
        .catch(() => {
          // 점만 못 채운다 — 다음 이동 때 다시 시도하도록 범위를 되돌린다.
          if (coveredFromRef.current === from) coveredFromRef.current = covered;
        });
    }
    const day = await fetchHouseMemberDay(houseId, membershipId, date).catch(() => null);
    if (seq !== daySeqRef.current || targetRef.current !== target) return;
    setFriendRoom((prev) => ({
      ...prev,
      routines: day ? toFriendRoutines(day) : [],
      categories: day ? toFriendCategories(day) : [],
      dayLoading: false,
      dayError: day == null,
    }));
  }, []);

  /**
   * 같은 집 구성원 방의 거미줄을 대신 치운다 (#831) — 성공하면 청소자가
   * 받은 코인 수를 돌려준다. 화면이 그 값으로만 코인 연출을 쏘므로
   * 실패·중복은 null이어야 한다 (내 방 청소 #830과 같은 계약).
   *
   * 참조 안정 필수 (#539) — 셸이 memo 화면의 콜백에 넣는다.
   */
  const cleanCobweb = useCallback(
    async (houseId: number, membershipId: number): Promise<number | null> => {
      try {
        const res = await cleanHouseMemberCobweb(houseId, membershipId);
        qc.removeQueries({ queryKey: queryKeys.memberRoom.one(houseId, membershipId) });
        setFriendRoom((prev) => ({ ...prev, cobweb: null }));
        return res.rewardAmount ?? 0;
      } catch (err) {
        // 남이 먼저 치웠다 — 실패가 아니라 이미 깨끗해진 것. 보상은 없다.
        if (err instanceof ApiError && err.code === ErrorCode.ROOM_COBWEB_NOT_ACTIVE) {
          qc.removeQueries({ queryKey: queryKeys.memberRoom.one(houseId, membershipId) });
          setFriendRoom((prev) => ({ ...prev, cobweb: null }));
          return null;
        }
        throw err;
      }
    },
    [qc],
  );

  /**
   * 스와이프 이웃 미리 받기 (#1635) — 방·오늘 목록·완료 기록을 캐시에 올려 두기만 한다.
   * 화면 상태는 건드리지 않고, 실패는 조용히 접는다(넘겼을 때 평소처럼 받으면 된다).
   * 참조 안정(#539): 셸 효과의 의존성에 들어간다.
   */
  const prefetch = useCallback(
    (houseId: number, membershipId: number) => {
      const today = todayIso();
      void fetchMemberRoom(qc, houseId, membershipId).catch(() => {});
      void qc.prefetchQuery(memberDayQuery(houseId, membershipId, today));
      void qc.prefetchQuery(memberCompletionsQuery(houseId, membershipId, today));
    },
    [qc],
  );

  return {
    cleanCobweb,
    friendRoom,
    load,
    prefetch,
    selectDate,
  };
}
