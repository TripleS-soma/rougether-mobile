import { ROOM_RENDER_CONTRACT, roomSlotCenter } from '@/components/room/room-render-contract';
import { SLOT_ORDER } from '@/resources/furniture';

describe('ROOM_RENDER_CONTRACT', () => {
  it('keeps every slot inside the normalized square and derives its center', () => {
    for (const slot of SLOT_ORDER) {
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
