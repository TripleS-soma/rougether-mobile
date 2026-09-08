/** Wallet / gacha / shop (item catalogue) adapters. */
import { type Wallet } from '@/constants/currency';
import { GACHA_CATEGORY_META, getGachaCategory } from '@/constants/gacha';
import { GachaAccents, WallpaperTints } from '@/constants/theme';
import {
  DEFAULT_WALLPAPER_ID,
  type FurnitureCategory,
  type FurnitureItem,
  type FurnitureSlot,
  type Wallpaper,
} from '@/resources/furniture';
import { type PictogramName } from '@/components/ui/pictograms';
import type {
  GachaCategory,
  GachaResponse,
  ItemResponse,
  MyItemSummary,
  WalletHistoryResponse,
} from '@/api/types';

// --- wallet -------------------------------------------------------------------
// Accepts both WalletResponse (from /me/wallets) and WalletSummary (embedded in
// purchase/draw responses) — they share this shape.
type WalletLike = { currencyType?: 'COIN' | 'DIAMOND'; balance?: number };

/** 재화 이력 사유 → 표시 라벨 (#734, 스웨거 enum 7종). */
const WALLET_REASON_LABELS: Record<string, string> = {
  ROUTINE_COMPLETE: '루틴 완료',
  TODO_COMPLETE: '할 일 완료',
  SIGNUP_BONUS: '가입 보너스',
  GACHA_DUPLICATE_CONVERT: '뽑기 중복 전환',
  INVITE_REWARD: '친구 초대 보상',
  GACHA_DRAW: '뽑기',
  SHOP_PURCHASE: '상점 구매',
};

/** 지갑 내역 행 표시 모델 (#734). */
export type WalletHistoryEntry = {
  id: number;
  currency: 'coin' | 'diamond';
  /** 적립 양수 / 사용 음수 — 서버 부호 그대로. */
  amount: number;
  /** 사유 한국어 라벨 (미지의 enum은 원문 폴백). */
  reason: string;
  /** 증감 직후 잔액. */
  balanceAfter: number;
  /** ISO 시각 — 표시 포맷은 화면 몫. */
  createdAt?: string;
};

export function toWalletHistoryEntry(h: WalletHistoryResponse): WalletHistoryEntry | null {
  if (h.id == null || h.amount == null) return null;
  return {
    id: h.id,
    currency: h.currencyType === 'DIAMOND' ? 'diamond' : 'coin',
    amount: h.amount,
    reason: (h.reason && WALLET_REASON_LABELS[h.reason]) || h.reason || '기타',
    balanceAfter: h.balanceAfter ?? 0,
    createdAt: h.createdAt,
  };
}

export function toWallet(list: WalletLike[]): Wallet {
  let coin = 0;
  let diamond = 0;
  for (const w of list) {
    if (w.currencyType === 'COIN') coin = w.balance ?? 0;
    else if (w.currencyType === 'DIAMOND') diamond = w.balance ?? 0;
  }
  return { coin, diamond };
}

// --- gacha --------------------------------------------------------------------
// Category icons and accents are stable across server ordering. These indexed
// fallbacks only support legacy machines that do not declare a category.
const GACHA_ICONS: PictogramName[] = [
  'gift',
  'pagoda',
  'leaf',
  'croissant',
  'moon',
  'teddy',
  'planet',
  'blossom',
];

export type GachaMachine = {
  id: number;
  name: string;
  costCurrencyType: 'COIN' | 'DIAMOND';
  costAmount: number;
  drawCount: number;
  icon: PictogramName;
  accent: string;
  /**
   * 서버가 준 선물상자 아트 키 (서버 #276). CDN 키가 아니거나 비어 있으면
   * 화면이 `icon` 픽토그램으로 폴백한다 — `isCdnKey`로 판정할 수 있게
   * 가공하지 않고 그대로 싣는다.
   */
  giftBoxKey?: string;
  /** Compatibility grouping; all decoration categories belong to furniture. */
  kind: 'furniture' | 'character';
  category?: GachaCategory;
  /** 서버 기계 코드 (`bakery_morning` 등) — 노출 판정에 쓴다 (#983). */
  code?: string;
};

export function toGachaMachine(g: GachaResponse, index = 0): GachaMachine {
  const category = getGachaCategory(g);
  const categoryMeta = category ? GACHA_CATEGORY_META[category] : undefined;
  return {
    id: g.gachaId ?? 0,
    code: g.code,
    name: g.name ?? '',
    costCurrencyType: g.costCurrencyType ?? 'COIN',
    costAmount: g.costAmount ?? 0,
    drawCount: g.drawCount ?? 1,
    icon: categoryMeta?.icon ?? GACHA_ICONS[index % GACHA_ICONS.length],
    accent: categoryMeta?.accent ?? GachaAccents[index % GachaAccents.length],
    giftBoxKey: g.giftBoxAssetKey,
    category,
    kind: category || !g.code?.startsWith('character') ? 'furniture' : 'character',
  };
}

// --- shop (items) -------------------------------------------------------------
// The API's `defaultSlot` uses the same names as the app's FurnitureSlot, so
// positioned items map straight onto the room's slots.
const CATEGORY_LABEL: Record<string, FurnitureCategory> = {
  furniture: '가구',
  decor: '장식',
  floor: '러그',
};
const VALID_SLOTS: FurnitureSlot[] = [
  'topLeft',
  'topCenter',
  'topRight',
  'midLeft',
  'midRight',
  'bottomLeft',
  'bottomCenter',
  'bottomRight',
];
// Placeholder tints for wallpapers, cycled by index so tiles stay
// distinguishable until real art exists (the API supplies no room-fill color).

const isPositioned = (i: ItemResponse) =>
  i.placementType === 'positioned' &&
  !!i.defaultSlot &&
  VALID_SLOTS.includes(i.defaultSlot as FurnitureSlot);

/** "Forest Sage Set - Arched Window" → "Arched Window" (theme shows separately). */
const stripSetPrefix = (name?: string) => (name ?? '').replace(/^.*?Set\s*-\s*/, '');

function toFurnitureItem(item: ItemResponse): FurnitureItem {
  return {
    id: String(item.id ?? ''),
    name: stripSetPrefix(item.name),
    slot: (item.defaultSlot as FurnitureSlot) ?? 'topLeft',
    category: CATEGORY_LABEL[item.categoryCode ?? ''] ?? '장식',
    price: item.priceAmount ?? 0,
    assetKey: item.assetKey ?? '',
    defaultScale: item.defaultScale ?? 1,
    defaultPositionX: item.defaultPositionX ?? undefined,
    defaultPositionY: item.defaultPositionY ?? undefined,
    theme: item.theme?.name,
  };
}

function toWallpaper(item: ItemResponse, index = 0): Wallpaper {
  return {
    id: String(item.id ?? ''),
    name: stripSetPrefix(item.name),
    price: item.priceAmount ?? 0,
    assetKey: item.assetKey ?? '',
    color: WallpaperTints[index % WallpaperTints.length],
    theme: item.theme?.name,
  };
}

export type ShopCatalogue = {
  furniture: FurnitureItem[];
  wallpapers: Wallpaper[];
  /** Floor/background surfaces (categoryCode floor/background) — single-select like wallpaper. */
  floors: Wallpaper[];
  backgrounds: Wallpaper[];
  ownedIds: string[];
};

// Surface items share the wallpaper shape: one per room surface slot.
const bySurfaceCategory = (items: ItemResponse[], categoryCode: string) =>
  items.filter((i) => i.categoryCode === categoryCode).map((i, idx) => toWallpaper(i, idx));

export function toShopCatalogue(
  items: ItemResponse[],
  inventory: MyItemSummary[] = [],
): ShopCatalogue {
  // Personal AI furniture is not part of the public shop catalogue.
  const merged = new Map(items.map((item) => [item.id, item]));
  for (const owned of inventory) {
    if (owned.itemId == null) continue;
    const existing = merged.get(owned.itemId);
    merged.set(owned.itemId, { ...existing, ...owned, id: owned.itemId, owned: true });
  }
  items = [...merged.values()];
  return {
    furniture: items.filter(isPositioned).map(toFurnitureItem),
    wallpapers: bySurfaceCategory(items, 'wallpaper'),
    floors: bySurfaceCategory(items, 'floor'),
    backgrounds: bySurfaceCategory(items, 'background'),
    ownedIds: items.filter((i) => i.owned).map((i) => String(i.id)),
  };
}

/**
 * 저장 전 방의 **표면 기본값** — 소유한 벽지·바닥·배경에서 고른다.
 *
 * 예전엔 슬롯마다 소유 가구를 하나씩 채워 "빈 방을 피하는" 역할도 했는데,
 * 가구를 놓을 앵커가 사라져(#925) 표면만 남았다. 가구는 사용자가 놓은
 * 자리(placements)에만 나온다.
 */
export function ownedPlacement(cat: ShopCatalogue): {
  wallpaperId: string;
  floorId: string | null;
  backgroundId: string | null;
} {
  const owned = new Set(cat.ownedIds);
  const wp = cat.wallpapers.find((w) => owned.has(w.id));
  return {
    wallpaperId: wp?.id ?? cat.wallpapers[0]?.id ?? DEFAULT_WALLPAPER_ID,
    floorId: cat.floors.find((f) => owned.has(f.id))?.id ?? null,
    backgroundId: cat.backgrounds.find((b) => owned.has(b.id))?.id ?? null,
  };
}
