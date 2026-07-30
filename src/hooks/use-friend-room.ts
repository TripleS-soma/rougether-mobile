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
} from '@/api';
import {
  characterIdFromCode,
  fromFriendRoomSlots,
  fromRoomPlacements,
  type ShopCatalogue,
  toFriendActivity,
  toFriendCategories,
  toFriendRoutines,
} from '@/api/adapters';
import type { CharacterAnimationSet } from '@/components/character-avatar';
import type { FriendActivityDay } from '@/components/screens/friend-room-screen';
import type { CharacterId } from '@/constants/characters';
import type { Routine, RoutineCategoryMeta } from '@/constants/routines';
import { DEFAULT_WALLPAPER_ID, type PlacedFurniture } from '@/resources/furniture';

/** 친구 방 배치 — FREE_V1이면 placements, 아니면 슬롯 id 목록으로 렌더 (#327). */
export type FriendRoomPlacement = {
  placedFurnitureIds: string[];
  wallpaperId: string;
  floorId: string | null;
  backgroundId: string | null;
  placements: PlacedFurniture[] | null;
};

export type FriendRoom = {
  /** null until the room endpoint answered (renders as an empty room). */
  placement: FriendRoomPlacement | null;
  characterId?: CharacterId;
  /** The friend's CDN animation keys (room response); local sprite fallback. */
  characterAnimations?: CharacterAnimationSet;
  streakDays: number;
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
    async (houseId?: number, membershipId?: number, catalogue?: ShopCatalogue) => {
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
      const resolved = room && catalogue ? fromFriendRoomSlots(room.slots ?? [], catalogue) : null;
      // FREE_V1 친구 방은 placements를 assetKey 기준으로 해석해 그대로 렌더 (#327).
      const friendPlacements =
        room && catalogue && room.layoutFormat === 'FREE_V1' && room.placements?.length
          ? fromRoomPlacements(room.placements, catalogue)
          : null;
      // Same guard as toOwnedCharacter: a code the app doesn't know renders as the
      // default character, so its animations must not ride along (wrong pairing).
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
        characterAnimations: friendCharacterId ? room?.character?.animations : undefined,
        streakDays: room?.streak?.currentCount ?? 0,
        routines: day ? toFriendRoutines(day) : [],
        categories: day ? toFriendCategories(day) : [],
        // undefined on failure hides the section instead of faking an empty history.
        recentActivity: completions ? toFriendActivity(completions) : undefined,
        loading: false,
      });
    },
    [],
  );

  return { friendRoom, load };
}
