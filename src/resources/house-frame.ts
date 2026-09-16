import { ROOM_ASPECT_RATIO } from '@/components/room/room-render-contract';
import { i18n } from '@/i18n';
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

// Stretch only the frame artwork to keep its transparent holes aligned with
// portrait rooms. Percentages remain those of the immutable published bitmap.
const LEGACY_DISPLAY_ASPECT = ROOM_ASPECT_RATIO * (33 / 37);

// Keep the original release for the seven dev-only skins. Display asset keys
// never replace canonical cover keys in create/update requests.
export const STACKED_HOUSE_RELEASE = 'stacked-v1-20260905';
const ROUNDED_FRAME_RELEASE_BY_THEME: Readonly<Record<string, string | undefined>> = {
  'cloud-balloon': 'cloud-renewed-v1-20260909',
  'coral-lagoon': 'coral-renewed-v1-20260909',
  'mushroom-forest': 'mushroom-grass-v1-20260909',
  'night-observatory': 'night-renewed-v1-20260909',
};
/**
 * 테마 표시명은 i18n `house.coverNames.<id>` (#893) — 호출 시점 언어로 읽는다.
 * id는 CDN 폴더 슬러그라 번역하지 않는다.
 */
const houseTheme = <Id extends string>(id: Id, group: 1 | 2 | 3, legacyKey: string | null) => ({
  id,
  get name(): string {
    return i18n.t(`house.coverNames.${id}`);
  },
  group,
  legacyKey,
});

export const STACKED_HOUSE_THEMES = [
  houseTheme('cloud-balloon', 1, DEFAULT_HOUSE_COVER_KEY),
  houseTheme('coral-lagoon', 1, 'house/coral-aquarium/house-unified-coral-aquarium-frame.png'),
  houseTheme('mushroom-forest', 1, 'house/mushroom-forest/house-unified-mushroom-forest-frame.png'),
  houseTheme(
    'night-observatory',
    1,
    'house/night-observatory/house-unified-night-observatory-frame-v3.png',
  ),
  houseTheme('moonlit-hanok', 2, null),
  houseTheme('morning-bakery', 2, null),
  houseTheme('sakura-teahouse', 2, null),
  houseTheme('coastal-lighthouse', 3, null),
  houseTheme('snowy-cabin', 3, null),
  houseTheme('herb-greenhouse', 3, null),
  houseTheme('clockwork-cottage', 3, null),
] as const;

/**
 * 집 커버 표시명 (#893). 커버 카탈로그 이름은 서버가 한국어로 내려준다 — 한국어에서는
 * 서버 이름을 그대로 쓰고(서버가 원본), 다른 언어에서는 커버 키의 폴더 슬러그
 * (`house/<slug>/…`)로 `house.coverNames.<slug>`를 찾는다. 모르는 슬러그는 서버 이름.
 */
export function houseCoverName(coverImageKey: string, serverName: string): string {
  if (i18n.language.startsWith('ko')) return serverName;
  const slug = /^house\/([^/]+)\//.exec(coverImageKey)?.[1];
  if (!slug) return serverName;
  return i18n.t(`house.coverNames.${slug}`, { defaultValue: serverName });
}
export type StackedHouseThemeId = (typeof STACKED_HOUSE_THEMES)[number]['id'];

// Enable the approved canonical covers by default. An explicit
// zero builds a rollback bundle; this is not a live remote kill switch.
export const STACKED_HOUSES_ENABLED = process.env.EXPO_PUBLIC_STACKED_HOUSES !== '0';

const percent = (value: number, total: number): Percent => `${(value / total) * 100}%`;
const stackedGeometry = (capacity: 2 | 4 | 6) => {
  const width = 1024;
  const height = 872 + (capacity / 2 - 1) * 352;
  return {
    sourceAspectRatio: width / height,
    aspectRatio: (width / height) * ROOM_ASPECT_RATIO,
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
  sourceAspectRatio: number;
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
    sourceAspectRatio: FRAME_ASPECT,
    aspectRatio: LEGACY_DISPLAY_ASPECT,
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
  const release = ROUNDED_FRAME_RELEASE_BY_THEME[theme.id] ?? STACKED_HOUSE_RELEASE;
  return {
    kind: 'stacked',
    canonicalKey,
    assetKey: `house/${theme.id}/frames/${release}/house-${theme.id}-${capacity}p-frame.webp`,
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
