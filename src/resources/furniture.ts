import { ROOM_RENDER_CONTRACT, roomSlotCenter } from '@/components/room/room-render-contract';

/**
 * Furniture & wallpaper resource catalog (ported/simplified from the prototype
 * `furniture.ts`). Each item carries an `assetKey`; the image is resolved
 * through the dummy resource layer (see asset.ts) until the real CDN exists.
 * Positioning is slot-based (RN-friendly) instead of the web's absolute CSS.
 */
export type Rarity = '일반' | '희귀' | '전설';

/** Display color per rarity tier (badges, reveal cards). */
export const RARITY_COLORS: Record<Rarity, string> = {
  일반: '#9AA0A6',
  희귀: '#7FA8D4',
  전설: '#E8A24A',
};

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

/** Canonical slot order (room layout: top row → mid sides → bottom row). */
export const SLOT_ORDER: FurnitureSlot[] = [
  'topLeft',
  'topCenter',
  'topRight',
  'midLeft',
  'midRight',
  'bottomLeft',
  'bottomCenter',
  'bottomRight',
];

/** User-facing label per placement slot (decor screen filter tabs). */
export const SLOT_LABELS: Record<FurnitureSlot, string> = {
  topLeft: '위 왼쪽',
  topCenter: '위 가운데',
  topRight: '위 오른쪽',
  midLeft: '중간 왼쪽',
  midRight: '중간 오른쪽',
  bottomLeft: '아래 왼쪽',
  bottomCenter: '아래 가운데',
  bottomRight: '아래 오른쪽',
};

/**
 * 자유 배치 한 점 (FREE_V1, #327) — 좌표는 방 렌더 영역 기준 0.0~1.0 정규화,
 * 가구의 **중심점**. z는 쌓임 순서(클수록 위). scale/rotation/flip은 2차에서
 * 편집 UI가 붙고, 렌더는 1차부터 지원한다.
 */
export type PlacedFurniture = {
  furnitureId: string;
  x: number;
  y: number;
  z: number;
  scale?: number;
  rotationDeg?: number;
  flipped?: boolean;
};

/**
 * 기존 슬롯 배치의 자유 배치 프리필 좌표 (#327) — Room의 SLOT_STYLE 앵커
 * (기본 폭 28%, 아래 코너 24%, 정사각 방)에서 계산한 중심점. 첫 자유 배치
 * 진입 시 SLOT_V1 방을 같은 모습으로 이어서 편집하게 한다.
 */
/** 슬롯 배치 id 목록 → 자유 배치 프리필 (z는 슬롯 순서). */
export function slotIdsToPlacements(
  placedIds: string[],
  furniture: FurnitureItem[],
): PlacedFurniture[] {
  return placedIds
    .map((id, i) => {
      const item = furniture.find((f) => f.id === id);
      if (!item) return null;
      const c = roomSlotCenter(item.slot);
      return { furnitureId: id, x: c.x, y: c.y, z: i + 1 };
    })
    .filter((p): p is PlacedFurniture => p !== null);
}

/**
 * 새 자유 배치 한 건 (#622) — 아이템 기본 위치(없으면 계약의 공용 중심)에
 * 최상위 z로 놓는다. 꾸미기 addItem과 뽑기 '방에 놓기'가 같은 로직을 쓴다.
 * 클램프 수식은 draggable-furniture.dragClampBounds(워클릿판)와 동일 —
 * 상수는 렌더 계약이 단일 출처라 함께 움직인다.
 */
export function newFreePlacement(item: FurnitureItem, items: PlacedFurniture[]): PlacedFurniture {
  const { baseWidth, editorScale, newPlacementCenter } = ROOM_RENDER_CONTRACT.furniture;
  const maxZ = items.reduce((m, p) => Math.max(m, p.z), 0);
  const scale = Math.min(editorScale.max, Math.max(editorScale.min, item.defaultScale ?? 1));
  const half = (baseWidth * scale) / 2;
  const clamp = (v: number) => Math.min(1 - half, Math.max(half, v));
  const hasItemDefault =
    typeof item.defaultPositionX === 'number' && typeof item.defaultPositionY === 'number';
  return {
    furnitureId: item.id,
    x: clamp(hasItemDefault ? item.defaultPositionX! : newPlacementCenter.x),
    y: clamp(hasItemDefault ? item.defaultPositionY! : newPlacementCenter.y),
    z: maxZ + 1,
    scale,
  };
}

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
  /** 새 FREE_V1 배치에만 적용되는 초기 배율. 기존 배치에는 소급하지 않는다. */
  defaultScale?: number;
  /** 새 FREE_V1 배치 중심점의 정규화 좌표. 둘 중 하나라도 없으면 공통 기본 위치를 사용한다. */
  defaultPositionX?: number;
  defaultPositionY?: number;
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
    defaultScale: 1.7,
  },
  {
    id: 'shelf',
    name: '책 선반',
    slot: 'topLeft',
    category: '가구',
    price: 450,
    assetKey: fk('shelf'),
    defaultScale: 1.2,
  },
  { id: 'window', name: '햇살 창문', slot: 'topCenter', category: '장식', price: 400, defaultScale: 1.3, assetKey: fk('window') }, // prettier-ignore
  { id: 'drawer', name: '민트 서랍', slot: 'topRight', category: '가구', price: 500, defaultScale: 1.2, assetKey: fk('drawer') }, // prettier-ignore
  {
    id: 'sofa',
    name: '구름 소파',
    slot: 'bottomRight',
    category: '가구',
    price: 700,
    assetKey: fk('sofa'),
    defaultScale: 1.6,
  },
  { id: 'plant', name: '초록 식물', slot: 'midLeft', category: '장식', price: 250, defaultScale: 0.9, assetKey: fk('plant') }, // prettier-ignore
  {
    id: 'rug',
    name: '체크 러그',
    slot: 'bottomCenter',
    category: '러그',
    price: 380,
    assetKey: fk('rug'),
    defaultScale: 1.8,
  },
  {
    id: 'clock',
    name: '벽 시계',
    slot: 'midRight',
    category: '장식',
    price: 300,
    assetKey: fk('clock'),
    defaultScale: 0.7,
  },
  // 고즈넉 한옥 테마 (가챠 보상) — 카테고리 '한옥', 상점가 0 (뽑기로만 획득)
  {
    id: 'hanok-bed',
    name: '한옥 자개 침대',
    slot: 'bottomLeft',
    category: '한옥',
    price: 0,
    assetKey: fk('hanok-bed'),
    defaultScale: 1.7,
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
    defaultScale: 1.2,
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
    defaultScale: 1.3,
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
    defaultScale: 1.8,
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
    defaultScale: 0.9,
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
    defaultScale: 1.1,
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
  /** Theme (item set) name, for the decor screen's theme filter. */
  theme?: string;
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
