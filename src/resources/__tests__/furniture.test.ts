import { ROOM_RENDER_CONTRACT } from '@/components/room/room-render-contract';
import { FURNITURE_ITEMS, newFreePlacement, type FurnitureItem } from '@/resources/furniture';

const item = (id: string): FurnitureItem => {
  const found = FURNITURE_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`missing catalog item: ${id}`);
  return found;
};

describe('newFreePlacement · defaultScale (#654)', () => {
  it('starts big furniture big and small furniture small', () => {
    expect(newFreePlacement(item('rug'), []).scale).toBe(1.8);
    expect(newFreePlacement(item('bed'), []).scale).toBe(1.7);
    expect(newFreePlacement(item('clock'), []).scale).toBe(0.7);
  });

  it('falls back to scale 1 without a defaultScale', () => {
    const bare: FurnitureItem = { ...item('bed'), defaultScale: undefined };
    expect(newFreePlacement(bare, []).scale).toBe(1);
  });

  it('clamps out-of-range defaultScale and keeps the item inside the room', () => {
    const { baseWidth, editorScale } = ROOM_RENDER_CONTRACT.furniture;
    const huge: FurnitureItem = { ...item('bed'), defaultScale: 99 };
    const placed = newFreePlacement(huge, []);
    expect(placed.scale).toBe(editorScale.max);
    const half = (baseWidth * editorScale.max) / 2;
    expect(placed.x).toBeGreaterThanOrEqual(half);
    expect(placed.x).toBeLessThanOrEqual(1 - half);
    expect(placed.y).toBeGreaterThanOrEqual(half);
    expect(placed.y).toBeLessThanOrEqual(1 - half);
  });

  it('every catalog defaultScale sits inside the editor clamp range', () => {
    const { min, max } = ROOM_RENDER_CONTRACT.furniture.editorScale;
    for (const i of FURNITURE_ITEMS) {
      if (i.defaultScale == null) continue;
      expect(i.defaultScale).toBeGreaterThanOrEqual(min);
      expect(i.defaultScale).toBeLessThanOrEqual(max);
    }
  });
});
