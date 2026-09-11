import { HOUSE_SCENE_MANIFEST, validHouseScene } from '@/resources/house-scene';
import { layoutHouseScene } from '@/resources/house-scene-layout';

describe.each(HOUSE_SCENE_MANIFEST.scenes)('$themeId $capacity responsive scene', (scene) => {
  it.each([
    [320, 568, 178, 92],
    [390, 844, 217, 114],
    [393, 852, 217, 114],
    [430, 932, 217, 114],
    [768, 1024, 182, 100],
  ])(
    'protects the entire house and every room at %s×%s',
    (width, height, headerBottom, navInset) => {
      const safe = {
        x: 8,
        y: headerBottom + 8,
        width: width - 16,
        height: height - headerBottom - navInset - 16,
      };
      const layout = layoutHouseScene(scene, { width, height }, safe)!;
      const roi = layout.protectedRect;
      expect(roi.x).toBeGreaterThanOrEqual(safe.x - 0.001);
      expect(roi.y).toBeGreaterThanOrEqual(safe.y - 0.001);
      expect(roi.x + roi.width).toBeLessThanOrEqual(safe.x + safe.width + 0.001);
      expect(roi.y + roi.height).toBeLessThanOrEqual(safe.y + safe.height + 0.001);
      expect(roi.width / scene.protectedRect.width).toBeCloseTo(
        roi.height / scene.protectedRect.height,
      );
      scene.roomRects.forEach((rect, i) => {
        const room = layout.roomRects[i];
        expect(room.x).toBeCloseTo(roi.x + (rect.x - scene.protectedRect.x) * layout.scale);
        expect(room.y).toBeCloseTo(roi.y + (rect.y - scene.protectedRect.y) * layout.scale);
        expect(room.width / room.height).toBeCloseTo(5 / 6);
        expect(room.y + room.height).toBeLessThanOrEqual(height - navInset);
      });
      expect(layout.imageRect.width / scene.width).toBeCloseTo(
        layout.imageRect.height / scene.height,
      );
    },
  );
});

it('rejects absent, clipped or border-touching protected regions before selecting an opaque scene', () => {
  const scene = HOUSE_SCENE_MANIFEST.scenes[0];
  expect(validHouseScene(scene)).toBe(true);
  for (const protectedRect of [
    undefined,
    { ...scene.protectedRect, x: 0 },
    { ...scene.protectedRect, width: scene.width },
    { x: 1, y: 1, width: 5, height: 5 },
  ]) {
    expect(validHouseScene({ ...scene, protectedRect: protectedRect! })).toBe(false);
  }
  expect(
    layoutHouseScene(scene, { width: 0, height: 0 }, { x: 0, y: 0, width: 0, height: 0 }),
  ).toBeUndefined();
});

it('crops surplus scenery instead of shrinking a house inside a wide original canvas', () => {
  const original = HOUSE_SCENE_MANIFEST.scenes[0];
  const scene = {
    ...original,
    width: 4000,
    height: 2000,
    protectedRect: { x: 1500, y: 700, width: 1000, height: 700 },
  };
  const layout = layoutHouseScene(
    scene,
    { width: 393, height: 852 },
    { x: 8, y: 220, width: 377, height: 510 },
  )!;
  expect(layout.protectedRect.width).toBeCloseTo(377);
  expect(layout.imageRect.width).toBeGreaterThan(393);
  expect(layout.scale).toBeCloseTo(377 / 1000);
  expect(layout.imageRect.width / layout.imageRect.height).toBe(2);
});
