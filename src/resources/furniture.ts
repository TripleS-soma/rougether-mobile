/**
 * Furniture & wallpaper resource catalog (ported/simplified from the prototype
 * `furniture.ts`). Each item carries an `assetKey`; the image is resolved
 * through the dummy resource layer (see asset.ts) until the real CDN exists.
 * Positioning is slot-based (RN-friendly) instead of the web's absolute CSS.
 */
export type Rarity = '일반' | '희귀' | '전설';

/**
 * A placement position in the room (not a furniture type), so any furniture
 * image can occupy any slot. Layout: 3 top / 2 mid sides / 3 bottom.
 */
export type FurnitureSlot =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'midLeft'
  | 'midRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

/** Catalog tab a furniture item belongs to (decor screen filter). */
export type FurnitureCategory = '가구' | '장식' | '러그' | '한옥';

export type FurnitureItem = {
  id: string;
  name: string;
  slot: FurnitureSlot;
  /** Catalog tab grouping (decor screen). */
  category: FurnitureCategory;
  /** Dia price in the shop; gacha-only items are 0. */
  price: number;
  /** Resource key → resolved to an image via assetSource(). */
  assetKey: string;
  /** Gacha reward metadata (optional). */
  theme?: string;
  rarity?: Rarity;
};

const fk = (id: string) => `furniture/${id}`;

export const FURNITURE_ITEMS: FurnitureItem[] = [
  {
    id: 'bed',
    name: '포근한 침대',
    slot: 'bottomLeft',
    category: '가구',
    price: 800,
    assetKey: fk('bed'),
  },
  {
    id: 'shelf',
    name: '책 선반',
    slot: 'topLeft',
    category: '가구',
    price: 450,
    assetKey: fk('shelf'),
  },
  { id: 'window', name: '햇살 창문', slot: 'topCenter', category: '장식', price: 400, assetKey: fk('window') }, // prettier-ignore
  { id: 'drawer', name: '민트 서랍', slot: 'topRight', category: '가구', price: 500, assetKey: fk('drawer') }, // prettier-ignore
  {
    id: 'sofa',
    name: '구름 소파',
    slot: 'bottomRight',
    category: '가구',
    price: 700,
    assetKey: fk('sofa'),
  },
  { id: 'plant', name: '초록 식물', slot: 'midLeft', category: '장식', price: 250, assetKey: fk('plant') }, // prettier-ignore
  {
    id: 'rug',
    name: '체크 러그',
    slot: 'bottomCenter',
    category: '러그',
    price: 380,
    assetKey: fk('rug'),
  },
  {
    id: 'clock',
    name: '벽 시계',
    slot: 'midRight',
    category: '장식',
    price: 300,
    assetKey: fk('clock'),
  },
  // 고즈넉 한옥 테마 (가챠 보상) — 카테고리 '한옥', 상점가 0 (뽑기로만 획득)
  {
    id: 'hanok-bed',
    name: '한옥 자개 침대',
    slot: 'bottomLeft',
    category: '한옥',
    price: 0,
    assetKey: fk('hanok-bed'),
    theme: 'hanok',
    rarity: '전설',
  },
  {
    id: 'hanok-shelf',
    name: '한옥 벽 선반',
    slot: 'topLeft',
    category: '한옥',
    price: 0,
    assetKey: fk('hanok-shelf'),
    theme: 'hanok',
    rarity: '희귀',
  },
  {
    id: 'hanok-window',
    name: '한옥 아치 창문',
    slot: 'topCenter',
    category: '한옥',
    price: 0,
    assetKey: fk('hanok-window'),
    theme: 'hanok',
    rarity: '희귀',
  },
  {
    id: 'hanok-rug',
    name: '한옥 풀잎 러그',
    slot: 'bottomCenter',
    category: '한옥',
    price: 0,
    assetKey: fk('hanok-rug'),
    theme: 'hanok',
    rarity: '일반',
  },
  {
    id: 'hanok-plant',
    name: '한옥 화분',
    slot: 'midLeft',
    category: '한옥',
    price: 0,
    assetKey: fk('hanok-plant'),
    theme: 'hanok',
    rarity: '일반',
  },
  {
    id: 'hanok-teatable',
    name: '한옥 다과상',
    slot: 'midRight',
    category: '한옥',
    price: 0,
    assetKey: fk('hanok-teatable'),
    theme: 'hanok',
    rarity: '희귀',
  },
];

export type Wallpaper = {
  id: string;
  name: string;
  /** Dia price in the shop. */
  price: number;
  assetKey: string;
  /** Fallback room background color while images are dummies. */
  color: string;
};

export const WALLPAPERS: Wallpaper[] = [
  { id: 'simple', name: '심플 베이지', price: 0, assetKey: 'wallpaper/simple', color: '#F3E9D6' },
  { id: 'paw', name: '발자국 패턴', price: 400, assetKey: 'wallpaper/paw', color: '#F5E6D3' },
  { id: 'flower', name: '꽃무늬 패턴', price: 450, assetKey: 'wallpaper/flower', color: '#F7E4EA' },
  { id: 'forest-simple', name: '숲속 벽지', price: 500, assetKey: 'wallpaper/forest-simple', color: '#E4F0DC' }, // prettier-ignore
  { id: 'hanok-simple', name: '한옥 벽지', price: 600, assetKey: 'wallpaper/hanok-simple', color: '#F2E8D7' }, // prettier-ignore
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
