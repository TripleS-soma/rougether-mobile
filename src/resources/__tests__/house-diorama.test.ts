import {
  dioramaMemberBoxes,
  dioramaSeatPages,
  houseDioramaTheme,
  selectDioramaFurniture,
  HOUSE_DIORAMA_THEMES,
  FOREST_CANOPY_COVER_KEY,
  EVENING_BRICK_COVER_KEY,
} from '@/resources/house-diorama';
import type { FurnitureItem } from '@/resources/furniture';

const item = (id: string, category: FurnitureItem['category'] = '가구'): FurnitureItem => ({
  id,
  name: id,
  category,
  assetKey: `items/test/furniture/${id}.png`,
  slot: 'bottomLeft',
  price: 0,
});
describe('shared house diorama', () => {
  it('supports both approved new covers and the existing four without changing stored keys', () => {
    expect(HOUSE_DIORAMA_THEMES).toHaveLength(6);
    expect(houseDioramaTheme(FOREST_CANOPY_COVER_KEY)?.id).toBe('forest-canopy');
    expect(houseDioramaTheme(EVENING_BRICK_COVER_KEY)?.id).toBe('evening-brick');
    expect(houseDioramaTheme('house/unknown/frame.png')).toBeUndefined();
    expect(houseDioramaTheme(FOREST_CANOPY_COVER_KEY, false)).toBeUndefined();
  });
  it('never decorates an empty room or invents unresolved/unplaced furniture', () => {
    expect(selectDioramaFurniture([], [item('bed')])).toEqual([]);
    expect(
      selectDioramaFurniture([{ furnitureId: 'unknown', x: 0, y: 0, z: 1 }], [item('bed')]),
    ).toEqual([]);
  });
  it('chooses only two placed real assets, with deterministic ordering and no duplicates', () => {
    const placements = ['lamp', 'bed', 'desk', 'bed'].map((id, i) => ({
      furnitureId: id,
      x: 0.5,
      y: 0.5,
      z: i,
      flipped: id === 'bed',
    }));
    const selected = selectDioramaFurniture(placements, [
      item('lamp', '장식'),
      item('bed'),
      item('desk'),
      item('unplaced'),
    ]);
    expect(selected.map((s) => s.item.id)).toEqual(['bed', 'desk']);
    expect(selected[0].flipped).toBe(true);
    expect(placements).toHaveLength(4);
  });
  it.each([0, 1] as const)('keeps every sprite contain box disjoint on side %i', (side) => {
    const boxes = dioramaMemberBoxes(side);
    for (const a of boxes) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x + a.width).toBeLessThanOrEqual(369 + 1e-8);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y + a.height).toBeLessThanOrEqual(300);
      for (const b of boxes.filter((b) => b !== a)) {
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(overlapX <= 0 || overlapY <= 0).toBe(true);
      }
    }
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
