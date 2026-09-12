import rawManifest from '@/resources/house-scenes/manifest.json';
import { HOUSE_SCENE_SOURCES } from '@/resources/house-scenes/sources';

export type HouseSceneRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
};
export type HouseSceneMetadata = {
  themeId: string;
  capacity: 2 | 4 | 6;
  file: string;
  width: number;
  height: number;
  roomRects: readonly HouseSceneRect[];
  protectedRect: HouseSceneRect;
  appearance: 'day' | 'night' | 'all';
};
export type HouseScene = HouseSceneMetadata & { source: number };
export const HOUSE_SCENE_MANIFEST = rawManifest as {
  version: number;
  scenes: HouseSceneMetadata[];
};
export const INTEGRATED_HOUSES_ENABLED = process.env.EXPO_PUBLIC_INTEGRATED_HOUSES !== '0';

/** Reject incomplete or out-of-bounds artwork instead of covering member rooms. */
export function validHouseScene(scene: HouseSceneMetadata): boolean {
  return (
    [2, 4, 6].includes(scene.capacity) &&
    Number.isFinite(scene.width) &&
    scene.width > 0 &&
    Number.isFinite(scene.height) &&
    scene.height > 0 &&
    !!scene.protectedRect &&
    [
      scene.protectedRect.x,
      scene.protectedRect.y,
      scene.protectedRect.width,
      scene.protectedRect.height,
    ].every(Number.isFinite) &&
    scene.protectedRect.x > 0 &&
    scene.protectedRect.y > 0 &&
    scene.protectedRect.width > 0 &&
    scene.protectedRect.height > 0 &&
    scene.protectedRect.x + scene.protectedRect.width < scene.width &&
    scene.protectedRect.y + scene.protectedRect.height < scene.height &&
    scene.roomRects.length === scene.capacity &&
    !scene.roomRects.some((rect, i) =>
      scene.roomRects
        .slice(i + 1)
        .some(
          (other) =>
            rect.x < other.x + other.width &&
            rect.x + rect.width > other.x &&
            rect.y < other.y + other.height &&
            rect.y + rect.height > other.y,
        ),
    ) &&
    scene.roomRects.every(
      (rect) =>
        [rect.x, rect.y, rect.width, rect.height, rect.radius ?? 0].every(Number.isFinite) &&
        rect.x >= 0 &&
        rect.y >= 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        (rect.radius ?? 0) >= 0 &&
        (rect.radius ?? 0) <= Math.min(rect.width, rect.height) / 2 &&
        rect.x + rect.width <= scene.width &&
        rect.y + rect.height <= scene.height &&
        rect.x >= scene.protectedRect.x &&
        rect.y >= scene.protectedRect.y &&
        rect.x + rect.width <= scene.protectedRect.x + scene.protectedRect.width &&
        rect.y + rect.height <= scene.protectedRect.y + scene.protectedRect.height,
    )
  );
}

export function resolveHouseScene(
  themeId: string,
  capacity: 2 | 4 | 6,
  scheme: 'light' | 'dark' = 'light',
): HouseScene | undefined {
  if (HOUSE_SCENE_MANIFEST.version !== 1) return undefined;
  const scene = HOUSE_SCENE_MANIFEST.scenes.find(
    (entry) =>
      entry.themeId === themeId &&
      entry.capacity === capacity &&
      (entry.appearance === 'all' || entry.appearance === (scheme === 'dark' ? 'night' : 'day')),
  );
  const source = scene && HOUSE_SCENE_SOURCES[scene.file];
  return scene && source != null && validHouseScene(scene) ? { ...scene, source } : undefined;
}
