import cloud_balloon from '@/assets/houses/shared-v1/cloud-balloon.webp';
import coral_aquarium from '@/assets/houses/shared-v1/coral-aquarium.webp';
import mushroom_forest from '@/assets/houses/shared-v1/mushroom-forest.webp';
import night_observatory from '@/assets/houses/shared-v1/night-observatory.webp';
import forest_canopy from '@/assets/houses/shared-v1/forest-canopy.webp';
import evening_brick from '@/assets/houses/shared-v1/evening-brick.webp';

import { ROOM_ASPECT_RATIO } from '@/components/room/room-render-contract';
import { houseDisplayMode, type HouseDisplayMode } from '@/resources/house-display-mode';
import type { HouseWindowRect } from '@/resources/house-frame';
import { DEFAULT_HOUSE_COVER_KEY } from '@/resources/house-frame';

export const HOUSE_DIORAMA_ASPECT = 2 / 3;
/** 집 그림(1024×1536) 안 구성원 칸 하나의 크기 — 층마다 왼쪽·오른쪽 두 칸. */
export const DIORAMA_WINDOW = { width: 369, height: 300 } as const;
export const FOREST_CANOPY_COVER_KEY = 'house/forest-canopy/house-forest-canopy-frame-v1.png';
export const EVENING_BRICK_COVER_KEY = 'house/evening-brick/house-evening-brick-frame-v1.png';

export type HouseDioramaTheme = {
  id: string;
  coverImageKey: string;
  source: number;
  skyColor: string;
  /**
   * 그림 맨 아래 띠의 평균색 (#1670) — 그림 아래(탭바 밑)와 아래로 당겼을 때 드러나는 곳을 칠한다.
   * 예전엔 화면 배경(skyColor)이 그대로 보여, 잔디 밑에 하늘색이 이어져 어색했다. 그림 하단 12px 평균.
   */
  groundColor: string;
  feet: readonly [number, number];
};

export const HOUSE_DIORAMA_THEMES: readonly HouseDioramaTheme[] = [
  {
    id: 'cloud-balloon',
    skyColor: '#a6cef5',
    groundColor: '#e6dadf',
    coverImageKey: DEFAULT_HOUSE_COVER_KEY,
    source: cloud_balloon,
    feet: [791, 1187],
  },
  {
    id: 'coral-aquarium',
    skyColor: '#58a0e9',
    groundColor: '#fbc37e',
    coverImageKey: 'house/coral-aquarium/house-unified-coral-aquarium-frame.png',
    source: coral_aquarium,
    feet: [781, 1198],
  },
  {
    id: 'mushroom-forest',
    skyColor: '#c4e3f1',
    groundColor: '#9c9c5c',
    coverImageKey: 'house/mushroom-forest/house-unified-mushroom-forest-frame.png',
    source: mushroom_forest,
    feet: [800, 1137],
  },
  {
    id: 'night-observatory',
    skyColor: '#705caa',
    groundColor: '#846f2b',
    coverImageKey: 'house/night-observatory/house-unified-night-observatory-frame-v3.png',
    source: night_observatory,
    feet: [795, 1200],
  },
  {
    id: 'forest-canopy',
    skyColor: '#e7e8c3',
    groundColor: '#c1bd69',
    coverImageKey: FOREST_CANOPY_COVER_KEY,
    source: forest_canopy,
    feet: [782, 1155],
  },
  {
    id: 'evening-brick',
    skyColor: '#826ba9',
    groundColor: '#9e823d',
    coverImageKey: EVENING_BRICK_COVER_KEY,
    source: evening_brick,
    feet: [797, 1200],
  },
];

export function houseDioramaTheme(
  key?: string | null,
  enabled = true,
  displayMode?: HouseDisplayMode,
) {
  if (
    !enabled ||
    houseDisplayMode(displayMode) === 'CLASSIC' ||
    process.env.EXPO_PUBLIC_HOUSE_DIORAMA === '0'
  )
    return undefined;
  return HOUSE_DIORAMA_THEMES.find(
    (theme) => theme.coverImageKey === (key || DEFAULT_HOUSE_COVER_KEY),
  );
}

export function dioramaWindowRects(theme: HouseDioramaTheme): readonly HouseWindowRect[] {
  return theme.feet.flatMap((foot) =>
    [125, 530].map((left) => ({
      left: `${(left / 1024) * 100}%` as const,
      top: `${((foot - DIORAMA_WINDOW.height) / 1536) * 100}%` as const,
      width: `${(DIORAMA_WINDOW.width / 1024) * 100}%` as const,
      height: `${(DIORAMA_WINDOW.height / 1536) * 100}%` as const,
    })),
  );
}

/** Preserve persisted seat indices while paging the visual floors in groups of four. */
export function dioramaSeatPages(rows: number[][]): (number | null)[][] {
  const visualRows = rows.slice().reverse();
  if (!visualRows.length) return [[null, null, null, null]];
  return Array.from({ length: Math.ceil(visualRows.length / 2) }, (_, page) => {
    const chunk = visualRows.slice(page * 2, page * 2 + 2);
    const slots: (number | null)[] = [null, null, null, null];
    chunk.forEach((row, r) =>
      row.forEach((seat, col) => {
        if (col < 2) slots[(chunk.length === 1 ? 2 : r * 2) + col] = seat;
      }),
    );
    return slots;
  });
}

/**
 * 칸 안에서 방이 차지하는 상자 (#1685) — 칸 비율(0~1).
 *
 * 예전엔 가구 2개만 골라 칸마다 고정 자리에 넣어(#1617) 방 배치와 달라 보였다. 이제 방을
 * 통째로 같은 비율로 줄인다: 높이를 칸에 맞추고(방 5:6이 칸보다 세로로 길다) 가로는 가운데.
 * 칸이 방보다 가로로 넓어 남는 양옆은 집 그림의 빈 벽으로 둔다.
 */
export function dioramaRoomBox() {
  const width = (DIORAMA_WINDOW.height * ROOM_ASPECT_RATIO) / DIORAMA_WINDOW.width;
  return { left: (1 - width) / 2, width };
}
