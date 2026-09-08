/**
 * 한 집의 상세 묶음 → House 모델 (#534). 상세·멤버·미션·입주신청을 전부
 * 병렬 요청한다 — 신청 목록은 방장이 아니면 403이라 실패를 빈 배열로
 * 무시하는 것으로 역할 확인 직렬 홉을 없앤다. 그 403은 api_error에서도
 * 빠진다(fetchHouseJoinRequests의 expectedStatuses, #1044).
 *
 * 순수 함수 — 상태를 들지 않으므로 useHouses가 닉네임 캐시만 넘긴다.
 */
import {
  fetchHouse,
  fetchHouseJoinRequests,
  fetchHouseMembers,
  fetchHouseMissions,
  getSessionUserId,
} from '@/api';
import { toHouse, toHouseMission } from '@/api/adapters';
import type { House } from '@/components/screens/house/types';

export async function fetchHouseBundle(
  id: number,
  /** 내 셀 라벨용 닉네임 — 멤버 API에 없을 때 프로필 닉네임으로 채운다. */
  myNickname: string | undefined,
): Promise<House> {
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
    myNickname,
    missions.map(toHouseMission),
    Date.now(),
    joinRequests,
  );
}
