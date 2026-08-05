import { type SeatRect, seatAtPoint } from '@/components/screens/house/seat-drag';

const rect = (x: number, y: number, w = 100, h = 80): SeatRect => ({ x, y, w, h });

describe('seatAtPoint (#693 분리 — PR #702 리뷰 후속)', () => {
  it('사각형 안이면 그 좌석, 밖이면 null', () => {
    const rects = new Map([
      [0, rect(0, 0)],
      [1, rect(120, 0)],
    ]);
    expect(seatAtPoint(rects, 50, 40)).toBe(0);
    expect(seatAtPoint(rects, 150, 40)).toBe(1);
    expect(seatAtPoint(rects, 110, 40)).toBeNull();
  });

  it('가장자리는 포함(≤) — 경계 드롭도 좌석으로 판정', () => {
    const rects = new Map([[3, rect(10, 20)]]);
    expect(seatAtPoint(rects, 10, 20)).toBe(3);
    expect(seatAtPoint(rects, 110, 100)).toBe(3);
    expect(seatAtPoint(rects, 110.5, 100)).toBeNull();
  });

  it('겹치는 사각형은 마지막 매치 우선 — 기존 forEach 판정과 동일 계약', () => {
    const rects = new Map([
      [0, rect(0, 0)],
      [1, rect(50, 0)], // 0과 x 50~100 구간이 겹침
    ]);
    expect(seatAtPoint(rects, 80, 40)).toBe(1);
  });

  it('빈 맵이면 null', () => {
    expect(seatAtPoint(new Map(), 10, 10)).toBeNull();
  });
});
