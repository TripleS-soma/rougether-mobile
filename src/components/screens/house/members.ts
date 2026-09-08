import type { House, RoomCell } from '@/components/screens/house/types';

/** 재실 멤버(빈 좌석 제외)를 층 라벨과 함께 평탄화 — 멤버 관리·강퇴 대상 목록. */
export function manageableMembers(house: House | undefined): (RoomCell & { level: string })[] {
  return (house?.floors ?? []).flatMap((f) =>
    f.rooms.filter((r) => !r.vacant).map((r) => ({ ...r, level: f.level })),
  );
}
