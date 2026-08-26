/**
 * A visited housemate's live room + today's routine list, from
 * `GET /houses/{houseId}/members/{membershipId}/room` and `…/day` (issue #149).
 * The friend's slots resolve against the shop catalogue by assetKey — their
 * userItemIds belong to their inventory, which we don't hold.
 */
import { useCallback, useRef, useState } from 'react';

import {
  fetchHouseMemberDay,
  fetchHouseMemberRoom,
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
  toFriendActivity,
  toFriendCategories,
  toFriendRoutines,
} from '@/api/adapters';
import type { FriendActivityDay } from '@/components/screens/friend-room-screen';
import type { CharacterId } from '@/constants/characters';
import type { Routine, RoutineCategoryMeta } from '@/constants/routines';
import { DEFAULT_WALLPAPER_ID, type PlacedFurniture } from '@/resources/furniture';
import { ErrorCode } from '@/api/error-codes';
import type { RoomCobweb } from '@/components/room/room';

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
  /** 친구 방에 낀 거미줄 (#829). */
  cobweb: RoomCobweb | null;
  routines: Routine[];
  /** 그날 루틴·투두의 공개 카테고리 메타 (#528) — 그룹 헤더용. */
  categories: RoutineCategoryMeta[];
  /** Recent completion history (14 days); undefined while unloaded/failed. */
  recentActivity?: FriendActivityDay[];
  loading: boolean;
  /**
   * 방·루틴·기록 3요청이 전멸했을 때 true (#549) — 방문 실패를 빈 방으로
   * 위장하지 않도록 화면이 실패+다시 시도를 보여준다. 부분 실패는 기존대로
   * 성공한 데이터만 렌더한다.
   */
  error?: boolean;
};

const EMPTY: FriendRoom = {
  placement: null,
  cobweb: null,
  streakDays: 0,
  routines: [],
  categories: [],
  loading: false,
};

export function useFriendRoom() {
  const [friendRoom, setFriendRoom] = useState<FriendRoom>(EMPTY);
  // Visits can be rapid (back → next friend); only the latest load may land.
  const seqRef = useRef(0);

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
      // 3요청 전멸 = 방문 자체가 실패 — 빈 방 대신 에러 상태로 (#549).
      if (!room && !day && !completions) {
        setFriendRoom({ ...EMPTY, error: true });
        return;
      }
      // 표면(벽지·바닥·배경)만 슬롯에서 읽는다 — 서버가 거기 저장한다 (서버 #162).
      const resolved = room && catalogue ? fromFriendRoomSlots(room.slots ?? [], catalogue) : null;
      // 가구는 자유 좌표가 정본 (#925) — assetKey 기준으로 해석해 그대로 렌더.
      const friendPlacements =
        room && catalogue ? fromRoomPlacements(room.placements ?? [], catalogue) : [];
      // Same guard as toOwnedCharacter: a code the app doesn't know renders as the
      // default character, so its frames must not ride along (wrong pairing).
      const friendCharacterId = characterIdFromCode(room?.character?.code);
      setFriendRoom({
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
        cobweb: room?.cobweb ?? null,
        routines: day ? toFriendRoutines(day) : [],
        categories: day ? toFriendCategories(day) : [],
        // undefined on failure hides the section instead of faking an empty history.
        recentActivity: completions ? toFriendActivity(completions) : undefined,
        loading: false,
      });
    },
    [],
  );

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
        setFriendRoom((prev) => ({ ...prev, cobweb: null }));
        return res.rewardAmount ?? 0;
      } catch (err) {
        // 남이 먼저 치웠다 — 실패가 아니라 이미 깨끗해진 것. 보상은 없다.
        if (err instanceof ApiError && err.code === ErrorCode.ROOM_COBWEB_NOT_ACTIVE) {
          setFriendRoom((prev) => ({ ...prev, cobweb: null }));
          return null;
        }
        throw err;
      }
    },
    [],
  );

  return {
    cleanCobweb,
    friendRoom,
    load,
  };
}
