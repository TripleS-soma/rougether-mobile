import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import type { RoomCell, MemberRoomPreview } from '@/components/screens/house/types';

/** Pure member appearance shared by rendering and the room-loading hook. */
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
