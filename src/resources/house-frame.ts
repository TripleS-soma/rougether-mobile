import { isCdnKey } from '@/resources/asset';

export const FRAME_ASPECT = 567 / 508;
export const DEFAULT_HOUSE_COVER_KEY = 'house/cloud-balloon/house-unified-cloud-balloon-frame.png';

export function houseCoverKey(key?: string | null): string {
  return key && isCdnKey(key) ? key : DEFAULT_HOUSE_COVER_KEY;
}

type Percent = `${number}%`;
export type HouseWindowRect = { left: Percent; top: Percent; width: Percent; height: Percent };

// Legacy bleed around the transparent holes is intentional (#287, #328).
export const WINDOW_RECTS: readonly HouseWindowRect[] = [
  { left: '11.7%', top: '23.9%', width: '37%', height: '33%' },
  { left: '50.3%', top: '23.9%', width: '37%', height: '33%' },
  { left: '11.7%', top: '57.6%', width: '37%', height: '33%' },
  { left: '50.3%', top: '57.6%', width: '37%', height: '33%' },
];

// Immutable published release. These are display assets, NEVER a save catalog.
// Source: house/releases/stacked-v1-20260905/manifest.json on the asset CDN.
export const STACKED_HOUSE_RELEASE = 'stacked-v1-20260905';
export const STACKED_HOUSE_THEMES = [
  { id: 'cloud-balloon', name: '구름 풍선 집', group: 1, legacyKey: DEFAULT_HOUSE_COVER_KEY },
  {
    id: 'coral-lagoon',
    name: '산호 조개 집',
    group: 1,
    legacyKey: 'house/coral-aquarium/house-unified-coral-aquarium-frame.png',
  },
  {
    id: 'mushroom-forest',
    name: '버섯 숲 집',
    group: 1,
    legacyKey: 'house/mushroom-forest/house-unified-mushroom-forest-frame.png',
  },
  { id: 'moonlit-hanok', name: '달빛 한옥', group: 2, legacyKey: null },
  { id: 'morning-bakery', name: '아침 빵집', group: 2, legacyKey: null },
  { id: 'sakura-teahouse', name: '벚꽃 찻집', group: 2, legacyKey: null },
  { id: 'coastal-lighthouse', name: '바닷바람 등대집', group: 3, legacyKey: null },
  { id: 'snowy-cabin', name: '눈꽃 통나무집', group: 3, legacyKey: null },
  { id: 'herb-greenhouse', name: '허브 온실집', group: 3, legacyKey: null },
  { id: 'clockwork-cottage', name: '태엽 시계집', group: 3, legacyKey: null },
] as const;
export type StackedHouseThemeId = (typeof STACKED_HOUSE_THEMES)[number]['id'];

// Build 113 enables the three approved legacy covers by default. An explicit
// zero builds a rollback bundle; this is not a live remote kill switch.
export const STACKED_HOUSES_ENABLED = process.env.EXPO_PUBLIC_STACKED_HOUSES !== '0';

const percent = (value: number, total: number): Percent => `${(value / total) * 100}%`;
const stackedGeometry = (capacity: 2 | 4 | 6) => {
  const width = 1024;
  const height = 872 + (capacity / 2 - 1) * 352;
  return {
    aspectRatio: width / height,
    windowRects: Array.from({ length: capacity }, (_, i) => ({
      left: percent(i % 2 === 0 ? 165 : 536, width),
      top: percent(358 + Math.floor(i / 2) * 352, height),
      width: percent(320, width),
      height: percent(320, height),
    })),
  };
};
const GEOMETRY = { 2: stackedGeometry(2), 4: stackedGeometry(4), 6: stackedGeometry(6) };

export type HouseFrameOptions = {
  maxMembers?: number;
  /** Never hide members when a stale capacity is smaller than the room list. */
  minimumSeats?: number;
  enabled?: boolean;
  /** Dev gallery only. Does not add anything to the public cover picker. */
  previewTheme?: StackedHouseThemeId;
  /** Reset transient image failures when the displayed house changes. */
  failureScope?: string | number;
};
export type HouseFrame = {
  kind: 'legacy' | 'stacked';
  assetKey: string;
  canonicalKey: string;
  aspectRatio: number;
  windowRects: readonly HouseWindowRect[];
};

export function resolveHouseFrame(
  key?: string | null,
  options: HouseFrameOptions = {},
): HouseFrame {
  const canonicalKey = houseCoverKey(key);
  const legacy: HouseFrame = {
    kind: 'legacy',
    assetKey: canonicalKey,
    canonicalKey,
    aspectRatio: FRAME_ASPECT,
    windowRects: WINDOW_RECTS,
  };
  if (!(options.enabled ?? STACKED_HOUSES_ENABLED)) return legacy;
  const seats = Math.max(options.maxMembers ?? 4, options.minimumSeats ?? 0);
  if (!Number.isInteger(seats) || seats < 1 || seats > 6) return legacy;
  const theme =
    __DEV__ && options.previewTheme
      ? STACKED_HOUSE_THEMES.find((t) => t.id === options.previewTheme)
      : STACKED_HOUSE_THEMES.find((t) => t.legacyKey === canonicalKey);
  if (!theme) return legacy;
  const capacity = seats <= 2 ? 2 : seats <= 4 ? 4 : 6;
  return {
    kind: 'stacked',
    canonicalKey,
    assetKey: `house/${theme.id}/frames/${STACKED_HOUSE_RELEASE}/house-${theme.id}-${capacity}p-frame.webp`,
    ...GEOMETRY[capacity],
  };
}

/** Bottom-align adapter rows without renumbering the persisted seat indices. */
export function houseWindowSeats(rows: number[][], windowCount: number): (number | null)[] {
  const slots: (number | null)[] = Array(windowCount).fill(null);
  rows
    .slice(-windowCount / 2)
    .reverse()
    .forEach((row, r) => {
      row.forEach((seat, col) => {
        if (col < 2) slots[windowCount - (r + 1) * 2 + col] = seat;
      });
    });
  return slots;
}
