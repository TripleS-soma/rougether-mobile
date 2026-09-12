import type { HouseSceneMetadata, HouseSceneRect } from '@/resources/house-scene';

type Rect = Pick<HouseSceneRect, 'x' | 'y' | 'width' | 'height'>;
export type HouseSceneLayout = {
  width: number;
  height: number;
  scale: number;
  safeRect: Rect;
  protectedRect: Rect;
  imageRect: Rect;
  roomRects: Rect[];
};

/** Fit the house, not the background. User zoom stays relative to this layout. */
export function layoutHouseScene(
  scene: HouseSceneMetadata,
  viewport: { width: number; height: number },
  safeRect: Rect,
): HouseSceneLayout | undefined {
  const { width, height } = viewport;
  const roi = scene.protectedRect;
  if (
    !roi ||
    ![width, height, safeRect.x, safeRect.y, safeRect.width, safeRect.height].every(
      Number.isFinite,
    ) ||
    width <= 0 ||
    height <= 0 ||
    safeRect.width <= 0 ||
    safeRect.height <= 0 ||
    safeRect.x < 0 ||
    safeRect.y < 0 ||
    safeRect.x + safeRect.width > width ||
    safeRect.y + safeRect.height > height
  )
    return undefined;
  const scale = Math.min(safeRect.width / roi.width, safeRect.height / roi.height);
  const target = {
    x: safeRect.x + (safeRect.width - roi.width * scale) / 2,
    y: safeRect.y + (safeRect.height - roi.height * scale) / 2,
    width: roi.width * scale,
    height: roi.height * scale,
  };
  const imageRect = {
    x: target.x - roi.x * scale,
    y: target.y - roi.y * scale,
    width: scene.width * scale,
    height: scene.height * scale,
  };
  return {
    width,
    height,
    scale,
    safeRect,
    protectedRect: target,
    imageRect,
    roomRects: scene.roomRects.map((rect) => ({
      x: imageRect.x + rect.x * scale,
      y: imageRect.y + rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    })),
  };
}
