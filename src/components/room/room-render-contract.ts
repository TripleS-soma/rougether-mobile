import rawContract from '@/components/room/room-render-contract.v2.json';

import type { FurnitureSlot } from '@/resources/furniture';

type NormalizedRect = {
  top: number;
  left: number;
  width: number;
  height?: number;
};

export type RoomRenderContract = {
  id: string;
  version: number;
  coordinateSpace: {
    type: 'normalized-rect';
    origin: 'top-left';
    furnitureAnchor: 'center';
  };
  room: { aspectRatio: number; borderRadiusPx: number };
  surfaces: Record<
    'background' | 'wallpaper' | 'floor',
    Required<NormalizedRect> & {
      contentFit: 'cover';
      contentPosition?: 'top' | 'bottom';
    }
  >;
  art: {
    wallpaper: { width: number; height: number };
    floor: { width: number; height: number };
    heroHeightRatio: number;
  };
  furniture: {
    baseWidth: number;
    aspectRatio: number;
    imagePaddingPx: number;
    borderRadiusPx: number;
    newPlacementCenter: { x: number; y: number };
    previewCenter: { x: number; y: number };
    editorScale: { min: number; max: number; step: number };
    slots: Record<FurnitureSlot, Pick<NormalizedRect, 'top' | 'left' | 'width'>>;
  };
  character: {
    centerX: number;
    bottom: number;
    width: number;
    aspectRatio: number;
    contentFit: 'contain';
  };
  referenceFixture: {
    id: string;
    surfaces: Record<
      'background' | 'wallpaper' | 'floor',
      {
        id: string;
        name: string;
        assetKey: string;
      }
    >;
    furniture: {
      id: string;
      name: string;
      assetKey: string;
      slot: FurnitureSlot;
      defaultScale: number;
    };
    character: {
      id: 'cat';
      name: string;
      animations: { idle: string; poseCycle: string; wave: string };
    };
  };
};

/**
 * 모바일 Room 렌더러의 기계 판독 가능한 정본. 관리자는 같은 버전의 JSON을
 * vendoring해 사용하고, 이 모듈은 RN 스타일과 자유배치 초기값을 여기서 파생한다.
 */
export const ROOM_RENDER_CONTRACT = rawContract as RoomRenderContract;
export const ROOM_ASPECT_RATIO = ROOM_RENDER_CONTRACT.room.aspectRatio;

const { baseWidth, editorScale } = ROOM_RENDER_CONTRACT.furniture;
const SCALE_MIN = editorScale.min;
const SCALE_MAX = editorScale.max;

/** Square furniture stays width-sized; normalized vertical bounds use room height. */
export function furnitureClampBounds(scale = 1, roomAspectRatio = ROOM_ASPECT_RATIO) {
  'worklet';
  const halfX = (baseWidth * Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale))) / 2;
  const halfY = halfX * roomAspectRatio;
  return { x: { min: halfX, max: 1 - halfX }, y: { min: halfY, max: 1 - halfY } };
}

export function roomFurnitureOrigin(x: number, y: number) {
  return {
    left: roomPercent(x - baseWidth / 2),
    top: roomPercent(y - (baseWidth * ROOM_ASPECT_RATIO) / 2),
  };
}

export const roomPercent = (value: number): `${number}%` => `${value * 100}%`;

export function roomSlotCenter(slot: FurnitureSlot) {
  const rect = ROOM_RENDER_CONTRACT.furniture.slots[slot];
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + (rect.width * ROOM_ASPECT_RATIO) / 2,
  };
}
