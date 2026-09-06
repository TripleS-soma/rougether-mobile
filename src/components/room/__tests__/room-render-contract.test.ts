import { ROOM_RENDER_CONTRACT, roomSlotCenter } from '@/components/room/room-render-contract';
import type { FurnitureSlot } from '@/resources/furniture';

// 앱은 더 이상 슬롯 앵커로 렌더하지 않지만(#925), 이 JSON은 **관리자 도구가
// vendoring하는 v1 계약**이라 기하 정보를 그대로 유지한다. 계약이 깨지지
// 않는지만 여기서 지킨다.
const SLOT_KEYS = Object.keys(ROOM_RENDER_CONTRACT.furniture.slots) as FurnitureSlot[];

describe('ROOM_RENDER_CONTRACT', () => {
  it('uses the new 2:1 surfaces without changing saved furniture coordinates', () => {
    const { wallpaper, floor } = ROOM_RENDER_CONTRACT.surfaces;
    expect(wallpaper.height).toBe(0.6667);
    expect(floor.top).toBe(wallpaper.height);
    expect(floor.top + floor.height).toBe(1);
    expect(wallpaper.contentPosition).toBe('bottom');
    expect(floor.contentPosition).toBe('top');
    expect(ROOM_RENDER_CONTRACT.art.wallpaper).toEqual({ width: 1205, height: 964 });
    expect(ROOM_RENDER_CONTRACT.art.floor).toEqual({ width: 1205, height: 482 });
    expect(ROOM_RENDER_CONTRACT.coordinateSpace.furnitureAnchor).toBe('center');
  });
  it('keeps every slot inside the normalized square and derives its center', () => {
    expect(SLOT_KEYS.length).toBeGreaterThan(0);
    for (const slot of SLOT_KEYS) {
      const rect = ROOM_RENDER_CONTRACT.furniture.slots[slot];
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.left + rect.width).toBeLessThanOrEqual(1);
      expect(rect.top + rect.width).toBeLessThanOrEqual(1);
      expect(roomSlotCenter(slot)).toEqual({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.width / 2,
      });
    }
  });

  it('preserves the mobile v1 geometry and real CDN reference fixture', () => {
    expect(ROOM_RENDER_CONTRACT).toMatchObject({
      id: 'rougether-room-renderer',
      version: 1,
      room: { aspectRatio: 1, borderRadiusPx: 16 },
      furniture: {
        baseWidth: 0.28,
        imagePaddingPx: 4,
        // max 3.5 (#654) — baseWidth 0.28 × 3.5 = 방 폭 98%; '방 안에 온전히'
        // 클램프(dragClampBounds)가 유효한 한계(1/0.28 ≈ 3.57) 안이어야 한다.
        editorScale: { min: 0.5, max: 3.5, step: 0.01 },
      },
      character: { centerX: 0.5, bottom: 0.16, width: 0.42, height: 0.42 },
    });
    expect(ROOM_RENDER_CONTRACT.furniture.slots.bottomLeft.width).toBe(0.24);
    expect(ROOM_RENDER_CONTRACT.furniture.slots.bottomRight.width).toBe(0.24);
    expect(ROOM_RENDER_CONTRACT.referenceFixture.furniture.assetKey).toMatch(
      /^items\/.+-animated-v\d+\.webp$/,
    );
    expect(ROOM_RENDER_CONTRACT.referenceFixture.character.animations.idle).toBe(
      'characters/cat/animations/idle.webp',
    );
  });
});
