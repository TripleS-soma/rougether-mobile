/**
 * Furniture & wallpaper resource catalog (ported/simplified from the prototype
 * `furniture.ts`). Each item carries an `assetKey`; the image is resolved
 * through the dummy resource layer (see asset.ts) until the real CDN exists.
 * Positioning is slot-based (RN-friendly) instead of the web's absolute CSS.
 */
export type Rarity = '일반' | '희귀' | '전설';

export type FurnitureSlot =
  'bed' | 'shelf' | 'window' | 'storage' | 'chair' | 'plant' | 'rug' | 'table';

export type FurnitureItem = {
  id: string;
  name: string;
  slot: FurnitureSlot;
  /** Resource key → resolved to an image via assetSource(). */
  assetKey: string;
  /** Gacha reward metadata (optional). */
  theme?: string;
  rarity?: Rarity;
};

const fk = (id: string) => `furniture/${id}`;

export const FURNITURE_ITEMS: FurnitureItem[] = [
  { id: 'bed', name: '포근한 침대', slot: 'bed', assetKey: fk('bed') },
  { id: 'shelf', name: '책 선반', slot: 'shelf', assetKey: fk('shelf') },
  { id: 'window', name: '햇살 창문', slot: 'window', assetKey: fk('window') },
  { id: 'drawer', name: '민트 서랍', slot: 'storage', assetKey: fk('drawer') },
  { id: 'sofa', name: '구름 소파', slot: 'chair', assetKey: fk('sofa') },
  { id: 'plant', name: '초록 식물', slot: 'plant', assetKey: fk('plant') },
  { id: 'rug', name: '체크 러그', slot: 'rug', assetKey: fk('rug') },
  { id: 'clock', name: '벽 시계', slot: 'table', assetKey: fk('clock') },
  // 고즈넉 한옥 테마 (가챠 보상)
  {
    id: 'hanok-bed',
    name: '한옥 자개 침대',
    slot: 'bed',
    assetKey: fk('hanok-bed'),
    theme: 'hanok',
    rarity: '전설',
  },
  {
    id: 'hanok-shelf',
    name: '한옥 벽 선반',
    slot: 'shelf',
    assetKey: fk('hanok-shelf'),
    theme: 'hanok',
    rarity: '희귀',
  },
  {
    id: 'hanok-window',
    name: '한옥 아치 창문',
    slot: 'window',
    assetKey: fk('hanok-window'),
    theme: 'hanok',
    rarity: '희귀',
  },
  {
    id: 'hanok-rug',
    name: '한옥 풀잎 러그',
    slot: 'rug',
    assetKey: fk('hanok-rug'),
    theme: 'hanok',
    rarity: '일반',
  },
  {
    id: 'hanok-plant',
    name: '한옥 화분',
    slot: 'plant',
    assetKey: fk('hanok-plant'),
    theme: 'hanok',
    rarity: '일반',
  },
  {
    id: 'hanok-teatable',
    name: '한옥 다과상',
    slot: 'table',
    assetKey: fk('hanok-teatable'),
    theme: 'hanok',
    rarity: '희귀',
  },
];

export type Wallpaper = {
  id: string;
  name: string;
  assetKey: string;
  /** Fallback room background color while images are dummies. */
  color: string;
};

export const WALLPAPERS: Wallpaper[] = [
  { id: 'simple', name: '심플 베이지', assetKey: 'wallpaper/simple', color: '#F3E9D6' },
  { id: 'paw', name: '발자국 패턴', assetKey: 'wallpaper/paw', color: '#F5E6D3' },
  { id: 'flower', name: '꽃무늬 패턴', assetKey: 'wallpaper/flower', color: '#F7E4EA' },
  { id: 'forest-simple', name: '숲속 벽지', assetKey: 'wallpaper/forest-simple', color: '#E4F0DC' },
  { id: 'hanok-simple', name: '한옥 벽지', assetKey: 'wallpaper/hanok-simple', color: '#F2E8D7' },
];

export const DEFAULT_WALLPAPER_ID = 'simple';

/** A pleasant default room (one item per slot). */
export const DEFAULT_PLACED_FURNITURE_IDS = [
  'bed',
  'shelf',
  'window',
  'drawer',
  'sofa',
  'plant',
  'rug',
  'clock',
];
