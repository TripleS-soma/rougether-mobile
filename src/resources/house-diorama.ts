import cloud_balloon from '@/assets/houses/shared-v1/cloud-balloon.webp';
import coral_aquarium from '@/assets/houses/shared-v1/coral-aquarium.webp';
import mushroom_forest from '@/assets/houses/shared-v1/mushroom-forest.webp';
import night_observatory from '@/assets/houses/shared-v1/night-observatory.webp';
import forest_canopy from '@/assets/houses/shared-v1/forest-canopy.webp';
import evening_brick from '@/assets/houses/shared-v1/evening-brick.webp';

import { houseDisplayMode, type HouseDisplayMode } from '@/resources/house-display-mode';
import type { HouseWindowRect } from '@/resources/house-frame';
import type { FurnitureItem, PlacedFurniture } from '@/resources/furniture';
import { DEFAULT_HOUSE_COVER_KEY } from '@/resources/house-frame';
import { isCdnKey } from '@/resources/asset';

export const HOUSE_DIORAMA_ASPECT = 2 / 3;
export const FOREST_CANOPY_COVER_KEY = 'house/forest-canopy/house-forest-canopy-frame-v1.png';
export const EVENING_BRICK_COVER_KEY = 'house/evening-brick/house-evening-brick-frame-v1.png';

export type HouseDioramaTheme = {
  id: string;
  coverImageKey: string;
  source: number;
  skyColor: string;
  feet: readonly [number, number];
};

export const HOUSE_DIORAMA_THEMES: readonly HouseDioramaTheme[] = [
  {
    id: 'cloud-balloon',
    skyColor: '#a6cef5',
    coverImageKey: DEFAULT_HOUSE_COVER_KEY,
    source: cloud_balloon,
    feet: [791, 1187],
  },
  {
    id: 'coral-aquarium',
    skyColor: '#58a0e9',
    coverImageKey: 'house/coral-aquarium/house-unified-coral-aquarium-frame.png',
    source: coral_aquarium,
    feet: [781, 1198],
  },
  {
    id: 'mushroom-forest',
    skyColor: '#c4e3f1',
    coverImageKey: 'house/mushroom-forest/house-unified-mushroom-forest-frame.png',
    source: mushroom_forest,
    feet: [800, 1137],
  },
  {
    id: 'night-observatory',
    skyColor: '#705caa',
    coverImageKey: 'house/night-observatory/house-unified-night-observatory-frame-v3.png',
    source: night_observatory,
    feet: [795, 1200],
  },
  {
    id: 'forest-canopy',
    skyColor: '#e7e8c3',
    coverImageKey: FOREST_CANOPY_COVER_KEY,
    source: forest_canopy,
    feet: [782, 1155],
  },
  {
    id: 'evening-brick',
    skyColor: '#826ba9',
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
      top: `${((foot - 300) / 1536) * 100}%` as const,
      width: `${(369 / 1024) * 100}%` as const,
      height: `${(300 / 1536) * 100}%` as const,
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

/** Show only already placed, resolvable objects. A missing catalogue must never invent decor. */
export function selectDioramaFurniture(
  placements: PlacedFurniture[] = [],
  catalog: FurnitureItem[] = [],
) {
  const items = new Map(catalog.map((item) => [item.id, item]));
  const seen = new Set<string>();
  return [...placements]
    .sort((a, b) => {
      const rank = (p: PlacedFurniture) => (items.get(p.furnitureId)?.category === '가구' ? 1 : 0);
      return (
        rank(b) - rank(a) ||
        (b.scale ?? 1) - (a.scale ?? 1) ||
        b.z - a.z ||
        a.furnitureId.localeCompare(b.furnitureId)
      );
    })
    .flatMap((placement) => {
      const item = items.get(placement.furnitureId);
      if (!item || !isCdnKey(item.assetKey) || seen.has(item.id)) return [];
      seen.add(item.id);
      return [{ item, flipped: !!placement.flipped }];
    })
    .slice(0, 2);
}

/** Fixed disjoint contain boxes make arbitrary furniture aspect ratios safe. */
export function dioramaMemberBoxes(side: 0 | 1) {
  const order =
    side === 0
      ? (['secondary', 'hero', 'character'] as const)
      : (['character', 'hero', 'secondary'] as const);
  const widths = { secondary: 82, hero: 210, character: 146 };
  const scale = (369 - 24) / 438;
  let left = 0;
  return order.map((kind) => {
    const width = widths[kind] * scale;
    const height = (kind === 'character' ? 150 : 230) * scale;
    const bottom = kind === 'character' ? 0 : kind === 'hero' ? 9 : 20;
    const box = { kind, x: left, y: 300 - bottom - height, width, height };
    left += width + 12;
    return box;
  });
}
