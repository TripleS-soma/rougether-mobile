import { fetchHouseMemberRoom } from '@/api';
import { onSessionCleared } from '@/api/auth';

/**
 * 집 구성원 방 응답 공유 캐시 (성능 장부 N5).
 *
 * 집 화면은 좌석 미리보기로 구성원마다 `GET …/members/{id}/room`을 받고, 좌석을 눌러 친구
 * 방에 들어가면 **방금 받은 같은 방을 또** 받았다. 짧은 신선도(`MEMBER_ROOM_TTL_MS`) 안에서는
 * 두 쪽이 같은 응답(진행 중이면 같은 요청)을 나눠 쓴다.
 *
 * - 실패한 요청은 남기지 않는다 — 다음 호출이 다시 받는다.
 * - 방이 바뀐 걸 아는 순간 버린다: 거미줄 청소(`invalidateMemberRoom(집, 구성원)`), 내 방
 *   꾸미기 저장(`invalidateMemberRoom()` — 전부).
 * - 로그아웃·계정 전환이면 전부 버린다.
 */
export const MEMBER_ROOM_TTL_MS = 30_000;

type Room = Awaited<ReturnType<typeof fetchHouseMemberRoom>>;
const cache = new Map<string, { at: number; promise: Promise<Room> }>();
const keyOf = (houseId: number, membershipId: number) => `${houseId}:${membershipId}`;

export function fetchMemberRoomShared(
  houseId: number,
  membershipId: number,
  now: () => number = Date.now,
): Promise<Room> {
  const key = keyOf(houseId, membershipId);
  const hit = cache.get(key);
  if (hit && now() - hit.at < MEMBER_ROOM_TTL_MS) return hit.promise;
  const entry = { at: now(), promise: fetchHouseMemberRoom(houseId, membershipId) };
  cache.set(key, entry);
  entry.promise.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  return entry.promise;
}

/** 한 구성원 방, 또는 인자 없이 전부 버린다. */
export function invalidateMemberRoom(houseId?: number, membershipId?: number): void {
  if (houseId == null || membershipId == null) cache.clear();
  else cache.delete(keyOf(houseId, membershipId));
}

onSessionCleared(() => cache.clear());
