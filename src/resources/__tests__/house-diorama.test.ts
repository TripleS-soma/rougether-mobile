import { ROOM_ASPECT_RATIO } from '@/components/room/room-render-contract';
import {
  dioramaRoomBox,
  dioramaSeatPages,
  houseDioramaTheme,
  DIORAMA_WINDOW,
  HOUSE_DIORAMA_THEMES,
  FOREST_CANOPY_COVER_KEY,
  EVENING_BRICK_COVER_KEY,
} from '@/resources/house-diorama';
describe('shared house diorama', () => {
  it('supports both approved new covers and the existing four without changing stored keys', () => {
    expect(HOUSE_DIORAMA_THEMES).toHaveLength(6);
    expect(houseDioramaTheme(FOREST_CANOPY_COVER_KEY)?.id).toBe('forest-canopy');
    expect(houseDioramaTheme(EVENING_BRICK_COVER_KEY)?.id).toBe('evening-brick');
    expect(houseDioramaTheme('house/unknown/frame.png')).toBeUndefined();
    expect(houseDioramaTheme(FOREST_CANOPY_COVER_KEY, false)).toBeUndefined();
  });
  // #1685: 칸에는 방(5:6)을 통째로 축소해 넣는다 — 높이를 칸에 맞추고 가로는 가운데.
  it('fits the whole room to the window height and centers it horizontally', () => {
    const box = dioramaRoomBox();
    expect(box.width).toBeCloseTo(
      (DIORAMA_WINDOW.height * ROOM_ASPECT_RATIO) / DIORAMA_WINDOW.width,
    );
    expect(box.width).toBeLessThan(1); // 칸이 방보다 가로로 넓다 — 양옆은 빈 벽.
    expect(box.left).toBeCloseTo((1 - box.width) / 2);
  });
  it.each([1, 3, 4, 6, 8, 10, 12])(
    'keeps all %i persisted seats reachable, including odd rows',
    (n) => {
      const rows = Array.from({ length: Math.ceil(n / 2) }, (_, r) =>
        Array.from({ length: Math.min(2, n - r * 2) }, (_, c) => r * 2 + c),
      ).reverse();
      const actual = dioramaSeatPages(rows)
        .flat()
        .filter((s): s is number => s != null);
      expect([...actual].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(new Set(actual).size).toBe(n);
    },
  );
});
