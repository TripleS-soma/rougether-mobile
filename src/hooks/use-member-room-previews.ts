/**
 * Miniature room previews for the 집 screen's member tiles: each member's live
 * room (`GET /houses/{houseId}/members/{membershipId}/room`) resolved against
 * the shop catalogue, keyed by membershipId. Loaded per house (cached until
 * the house changes); members whose fetch fails simply keep the plain tile.
 */
import { useCallback, useRef, useState } from 'react';

import { fetchHouseMemberRoom } from '@/api';
import {
  characterIdFromCode,
  fromFriendRoomSlots,
  fromRoomPlacements,
  type ShopCatalogue,
} from '@/api/adapters';
import type { House, MemberRoomPreview, RoomCell } from '@/components/screens/house-screen';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';

/**
 * Re-derive my tiles' character from the live worn character (#282). The
 * per-house preview cache goes stale the moment I swap characters — instead of
 * refetching the whole house, my seats simply wear `characterId`. Pass the
 * server-confirmed worn id only; `undefined` (not loaded yet) changes nothing,
 * so a swap made on another device isn't masked by a local guess.
 */
export function withMyCharacter(
  previews: Record<number, MemberRoomPreview>,
  houses: House[],
  characterId?: CharacterId,
): Record<number, MemberRoomPreview> {
  if (!characterId) return previews;
  const myMembershipIds = houses.flatMap((h) =>
    h.floors.flatMap((f) =>
      f.rooms.filter((r) => r.isMine && r.membershipId != null).map((r) => r.membershipId!),
    ),
  );
  const stale = myMembershipIds.filter(
    (id) => previews[id] && previews[id].characterId !== characterId,
  );
  if (stale.length === 0) return previews;
  const next = { ...previews };
  for (const id of stale) next[id] = { ...next[id], characterId };
  return next;
}

/**
 * 그 멤버 자신의 캐릭터 (#342) — 방 프리뷰에서 온다. 서버 멤버 목록에는
 * 캐릭터가 없어, 프리뷰가 아직 없으면 내 좌석만 내 캐릭터고 남은 기본 캐릭터.
 * 집 화면 좌석 타일과 구성원 관리 화면(#753에서 셸 화면으로 승격)이 공유한다.
 */
export function characterIdForMember(
  member: RoomCell,
  previews: Record<number, MemberRoomPreview> | undefined,
  myCharacterId: CharacterId,
): CharacterId {
  return (
    (member.membershipId != null ? previews?.[member.membershipId]?.characterId : undefined) ??
    (member.isMine ? myCharacterId : DEFAULT_CHARACTER_ID)
  );
}

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
      await Promise.all(
        membershipIds.map(async (membershipId) => {
          try {
            const room = await fetchHouseMemberRoom(houseId, membershipId);
            // 표면(벽지·바닥·배경)만 슬롯에서 읽는다 — 서버가 거기 저장한다.
            const surfaces = fromFriendRoomSlots(room.slots ?? [], catalogue);
            const preview: MemberRoomPreview = {
              // 가구는 자유 좌표가 정본이다 (#925) — layoutFormat 분기 없이 항상
              // placements. 아직 SLOT_V1인 방은 가구가 비어 있다.
              placements: fromRoomPlacements(room.placements ?? [], catalogue),
              wallpaperId: surfaces.wallpaperId ?? DEFAULT_WALLPAPER_ID,
              floorId: surfaces.floorId,
              backgroundId: surfaces.backgroundId,
              characterId: characterIdFromCode(room.character?.code),
              // 같은 집 구성원 방의 거미줄 (#829) — 타일에서도 보인다.
              cobweb: room.cobweb ?? null,
            };
            // 도착하는 대로 그 칸만 채운다. 예전엔 Promise.all이 끝난 뒤
            // 한 번에 넣어서, 정원 12명 집이면 **가장 느린 한 요청이 끝날
            // 때까지 좌석 전체가 빈 타일**이었다. 한 칸씩 켜지는 편이 총
            // 소요가 같아도 체감이 크게 다르다.
            // 집을 갈아탄 뒤 도착한 응답은 버린다(순서 역전 방지).
            if (loadedHouseRef.current !== houseId) return;
            setPreviews((prev) => ({ ...prev, [membershipId]: preview }));
          } catch {
            // Soft-fail: this member's tile stays plain.
          }
        }),
      );
    },
    [],
  );

  /**
   * 한 멤버 타일의 거미줄만 지운다 (#831) — 친구 방에서 치우고 돌아왔을 때
   * 타일에 그대로 껴 있으면 청소가 안 먹힌 것처럼 보인다. 전체 재조회는
   * 집 인원수만큼 요청이 나가므로 이 한 칸만 손본다.
   */
  const clearCobweb = useCallback((membershipId: number) => {
    setPreviews((prev) =>
      prev[membershipId]
        ? { ...prev, [membershipId]: { ...prev[membershipId], cobweb: null } }
        : prev,
    );
  }, []);

  /**
   * 캐시 무효화 (#1099) — 내 방 꾸미기를 저장하면 집 좌석의 내 방 미리보기가
   * 옛 방으로 남는다. 다음 집 화면 진입 때 그 집을 다시 불러오게만 표시하고,
   * 지금 그려진 미리보기는 새 응답이 올 때까지 남겨 둔다(빈 타일 깜빡임 방지).
   */
  const invalidate = useCallback(() => {
    loadedHouseRef.current = null;
  }, []);

  return { previews, load, clearCobweb, invalidate };
}
