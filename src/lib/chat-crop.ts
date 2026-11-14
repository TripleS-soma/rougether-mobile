import type { ChatCrop } from '@/api/chat-types';

/** 자르기 틀의 최소 크기(원본 대비 비율) — 이보다 작게는 줄어들지 않는다. */
export const CROP_MIN = 0.1;

export const FULL_CROP: ChatCrop = { x: 0, y: 0, width: 1, height: 1 };

export type CropHandle = 'move' | 'tl' | 'tr' | 'bl' | 'br';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** 사진 전체와 사실상 같은 영역인지 — 같으면 자르기 값을 보내지 않는다. */
export function isFullCrop(crop: ChatCrop | undefined): boolean {
  if (!crop) return true;
  return crop.x <= 0.001 && crop.y <= 0.001 && crop.width >= 0.999 && crop.height >= 0.999;
}

/** 서버에 보낼 값 — 전체 영역이면 생략, 아니면 소수 넷째 자리로 다듬고 범위 안에 가둔다. */
export function cropForUpload(crop: ChatCrop | undefined): ChatCrop | undefined {
  if (!crop || isFullCrop(crop)) return undefined;
  const round = (value: number) => Math.round(value * 10000) / 10000;
  const x = clamp(round(crop.x), 0, 1 - CROP_MIN);
  const y = clamp(round(crop.y), 0, 1 - CROP_MIN);
  return {
    x,
    y,
    width: clamp(round(crop.width), CROP_MIN, 1 - x),
    height: clamp(round(crop.height), CROP_MIN, 1 - y),
  };
}

/**
 * 손잡이를 (dx, dy)만큼 끈 뒤의 영역 — 값은 전부 원본 대비 비율이다. 가운데('move')는 크기를
 * 유지한 채 옮기고, 모서리는 맞은편 모서리를 고정한 채 늘이고 줄인다. 사진 밖으로 나가지 않고
 * `CROP_MIN`보다 작아지지 않는다.
 */
export function dragCrop(start: ChatCrop, handle: CropHandle, dx: number, dy: number): ChatCrop {
  if (handle === 'move') {
    return {
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    };
  }
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const left = handle === 'tl' || handle === 'bl';
  const top = handle === 'tl' || handle === 'tr';
  const x = left ? clamp(start.x + dx, 0, right - CROP_MIN) : start.x;
  const y = top ? clamp(start.y + dy, 0, bottom - CROP_MIN) : start.y;
  const width = left ? right - x : clamp(start.width + dx, CROP_MIN, 1 - start.x);
  const height = top ? bottom - y : clamp(start.height + dy, CROP_MIN, 1 - start.y);
  return { x, y, width, height };
}

/** 가운데를 기준으로 가로:세로 비율(`ratio`)에 맞춘 가장 큰 영역 — 원본이 `imageRatio`(가로/세로)일 때. */
export function centeredCrop(imageRatio: number, ratio: number): ChatCrop {
  if (!(imageRatio > 0) || !(ratio > 0)) return FULL_CROP;
  // 비율 단위로 본 틀의 가로/세로 = ratio / imageRatio.
  const relative = ratio / imageRatio;
  const width = relative >= 1 ? 1 : relative;
  const height = relative >= 1 ? 1 / relative : 1;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

/** 자른 뒤의 가로/세로 비율 — 원본 비율과 자르기 영역으로. 크기를 모르면 정사각으로 본다. */
export function croppedAspect(width?: number, height?: number, crop?: ChatCrop): number {
  const base = width && height ? width / height : 1;
  if (!crop) return base;
  return (base * crop.width) / crop.height;
}

/**
 * `box` 크기의 칸에 사진을 '채우기'로 넣을 때, 자르기 영역만 보이도록 사진을 놓을 자리.
 * 칸은 `overflow: hidden`이어야 한다. 반환값은 칸 기준 px.
 */
export function cropLayout(
  box: { width: number; height: number },
  aspect: number,
  crop: ChatCrop = FULL_CROP,
): { width: number; height: number; left: number; top: number } {
  // 자른 영역이 칸을 덮도록(cover) 배율을 정한다.
  const cropAspect = (aspect * crop.width) / crop.height;
  const boxAspect = box.width / box.height;
  const shownWidth = cropAspect >= boxAspect ? box.height * cropAspect : box.width;
  const shownHeight = shownWidth / cropAspect;
  const width = shownWidth / crop.width;
  const height = shownHeight / crop.height;
  return {
    width,
    height,
    left: (box.width - shownWidth) / 2 - crop.x * width,
    top: (box.height - shownHeight) / 2 - crop.y * height,
  };
}
