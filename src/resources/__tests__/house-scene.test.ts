import { HOUSE_SCENE_MANIFEST, validHouseScene, resolveHouseScene } from '@/resources/house-scene';
import { resolveHouseFrame, STACKED_HOUSE_THEMES } from '@/resources/house-frame';

describe('integrated house scene package', () => {
  it('maps every registered scene to local art and its exact original coordinate space', () => {
    const expected = ['cloud-balloon', 'coral-lagoon', 'mushroom-forest', 'night-observatory']
      .flatMap((theme) => [2, 4, 6].map((capacity) => `${theme}:${capacity}`))
      .sort();
    const actual = HOUSE_SCENE_MANIFEST.scenes
      .map((scene) => `${scene.themeId}:${scene.capacity}`)
      .sort();
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(12);
    for (const scene of HOUSE_SCENE_MANIFEST.scenes) {
      const theme = STACKED_HOUSE_THEMES.find((value) => value.id === scene.themeId)!;
      const frame = resolveHouseFrame(theme.legacyKey, {
        maxMembers: scene.capacity,
        integratedEnabled: true,
      });
      expect(frame.kind).toBe('integrated');
      expect(frame.canonicalKey).toBe(theme.legacyKey);
      expect(frame.scene?.source).toBeDefined();
      expect(frame.aspectRatio).toBe(scene.width / scene.height);
      expect(frame.windowRects).toHaveLength(scene.capacity);
      for (const viewportWidth of [320, 390, 768]) {
        const viewportHeight = viewportWidth / frame.aspectRatio;
        frame.windowRects.forEach((rect, index) => {
          const source = scene.roomRects[index];
          expect((parseFloat(rect.left) * viewportWidth) / 100).toBeCloseTo(
            (source.x * viewportWidth) / scene.width,
          );
          expect((parseFloat(rect.top) * viewportHeight) / 100).toBeCloseTo(
            (source.y * viewportWidth) / scene.width,
          );
        });
      }
      expect(resolveHouseScene(scene.themeId, scene.capacity, 'dark')?.file).toBe(scene.file);
    }
  });

  it('rejects missing seats, non-finite coordinates, invalid radius and outside apertures', () => {
    const scene = HOUSE_SCENE_MANIFEST.scenes[0];
    expect(validHouseScene(scene)).toBe(true);
    expect(validHouseScene({ ...scene, roomRects: [] })).toBe(false);
    for (const invalid of [
      { x: -1 },
      { width: NaN },
      { height: 0 },
      { y: scene.height },
      { radius: 900 },
    ]) {
      expect(
        validHouseScene({
          ...scene,
          roomRects: scene.roomRects.map((rect, index) => (index ? rect : { ...rect, ...invalid })),
        }),
      ).toBe(false);
    }
  });

  it('never invents a scene for unsupported themes or capacity and offers rollback', () => {
    expect(resolveHouseScene('missing-theme', 2)).toBeUndefined();
    expect(
      resolveHouseFrame('house/unknown/frame.png', { maxMembers: 6, integratedEnabled: true }).kind,
    ).toBe('legacy');
    expect(resolveHouseFrame(undefined, { maxMembers: 7, integratedEnabled: true }).kind).toBe(
      'legacy',
    );
    expect(resolveHouseFrame(undefined, { maxMembers: 2, integratedEnabled: false }).kind).toBe(
      'stacked',
    );
  });
});
