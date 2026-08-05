// 자리 드래그 앤 드롭(#278)의 순수 히트테스트 — house-screen.tsx에서 분리 (#693).

/** 리프트 시점에 measureInWindow로 잰 좌석 타일 사각형 (window 좌표). */
export type SeatRect = { x: number; y: number; w: number; h: number };

/** 드롭 좌표(window 기준)가 어느 좌석 위인지 — 벗어나면 null. */
export function seatAtPoint(
  rects: ReadonlyMap<number, SeatRect>,
  x: number,
  y: number,
): number | null {
  let hit: number | null = null;
  rects.forEach((r, idx) => {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) hit = idx;
  });
  return hit;
}
