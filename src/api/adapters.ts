/**
 * Mapping between the API's wire types (`./types`) and the app's domain models
 * (`@/constants/routines`, `@/constants/currency`). The app uses string ids
 * (the API's numeric id stringified), 0–6 weekday numbers (0 = Sun), and
 * "HH:MM" times; the API uses numeric ids, MON–SUN day codes, and "HH:mm:ss".
 */
import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';
import { type Wallet } from '@/constants/currency';
import {
  CATEGORY_COLORS,
  type CategoryVisibility,
  type NewRoutine,
  type Routine,
  type RoutineCategoryMeta,
} from '@/constants/routines';
import {
  DEFAULT_WALLPAPER_ID,
  type FurnitureCategory,
  type FurnitureItem,
  type FurnitureSlot,
  type Wallpaper,
} from '@/resources/furniture';

import { type OnboardingGoal } from '@/components/screens/onboarding-screen';
import type { Floor, House, RoomCell } from '@/components/screens/group-house-screen';
import type { SearchHouse } from '@/components/screens/house-search-screen';

import type {
  CategoryCreateRequest,
  CharacterItem,
  CategoryResponse,
  GachaResponse,
  GoalItem,
  HouseDetailResponse,
  HouseSummary,
  ItemResponse,
  MemberSummary,
  RoutineCreateRequest,
  RoutineResponse,
  RoutineUpdateRequest,
  TodayResponse,
  TodoCreateRequest,
  TodoResponse,
  TodoUpdateRequest,
} from './types';

// Weekday code by app day number (0 = Sunday … 6 = Saturday).
const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const dayNumToCode = (n: number) => DAY_CODES[n];
const dayCodeToNum = (code: string) => DAY_CODES.indexOf(code as (typeof DAY_CODES)[number]);

/** App category id (numeric string) → API categoryId; non-numeric ids are dropped. */
const toCategoryId = (category?: string): number | undefined => {
  const id = Number(category);
  return category && Number.isFinite(id) ? id : undefined;
};

/** "07:00" → "07:00:00" (API wants seconds). */
const toApiTime = (time: string) => (time.length === 5 ? `${time}:00` : time);
/** "07:00:00" → "07:00". */
const fromApiTime = (time: string) => time.slice(0, 5);

// --- visibility ---------------------------------------------------------------
// The API models two visibilities (PRIVATE / HOUSE); the app has three. Map to
// the closest match in each direction.
const visToApp = (v?: 'PRIVATE' | 'HOUSE'): CategoryVisibility =>
  v === 'HOUSE' ? 'public' : 'partial';
const visToApi = (v: CategoryVisibility): 'PRIVATE' | 'HOUSE' =>
  v === 'public' ? 'HOUSE' : 'PRIVATE';

// --- category -----------------------------------------------------------------
export function toAppCategory(c: CategoryResponse, index = 0): RoutineCategoryMeta {
  // iconKey holds an emoji (round-tripped) or an asset key like "icon_health";
  // fall back to a default glyph for the latter.
  const emoji = c.iconKey && !c.iconKey.startsWith('icon_') ? c.iconKey : '✨';
  return {
    id: String(c.id ?? ''),
    label: c.name ?? '',
    emoji,
    color: c.colorHex || CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    visibility: visToApp(c.visibility),
  };
}

export function toCategoryCreate(
  cat: RoutineCategoryMeta,
  sortOrder?: number,
): CategoryCreateRequest {
  return {
    name: cat.label,
    colorHex: cat.color,
    iconKey: cat.emoji,
    sortOrder,
    visibility: visToApi(cat.visibility),
  };
}

// --- routine ------------------------------------------------------------------
export function toAppRoutine(r: RoutineResponse): Routine {
  const isWeekly = r.repeatType === 'WEEKLY';
  return {
    id: String(r.id ?? ''),
    title: r.title ?? '',
    category: r.categoryId != null ? String(r.categoryId) : undefined,
    photoVerify: r.authType === 'PHOTO',
    days:
      isWeekly && r.repeatDays?.daysOfWeek
        ? r.repeatDays.daysOfWeek.map(dayCodeToNum).filter((n) => n >= 0)
        : undefined,
    startDate: r.startsOn,
    endDate: r.endsOn,
    alarmEnabled: !!r.scheduledTime,
    time: r.scheduledTime ? fromApiTime(r.scheduledTime) : undefined,
    kind: 'routine',
  };
}

export function toRoutineCreate(n: NewRoutine): RoutineCreateRequest {
  const weekly = !!(n.days && n.days.length);
  return {
    title: n.title,
    categoryId: toCategoryId(n.category),
    authType: n.photoVerify ? 'PHOTO' : 'CHECK',
    repeatType: weekly ? 'WEEKLY' : 'DAILY',
    repeatDays: weekly ? { daysOfWeek: n.days!.map(dayNumToCode) } : undefined,
    scheduledTime: n.alarmEnabled && n.time ? toApiTime(n.time) : undefined,
    startsOn: n.startDate,
    endsOn: n.endDate,
  };
}

/**
 * Build a full update body from the current app routine plus overrides. PUT
 * replaces the resource, so we always send the complete representation.
 */
export function toRoutineUpdate(
  r: Routine,
  overrides: Partial<Routine> = {},
): RoutineUpdateRequest {
  const merged = { ...r, ...overrides };
  const weekly = !!(merged.days && merged.days.length);
  return {
    title: merged.title,
    categoryId: toCategoryId(merged.category),
    authType: merged.photoVerify ? 'PHOTO' : 'CHECK',
    repeatType: weekly ? 'WEEKLY' : 'DAILY',
    repeatDays: weekly ? { daysOfWeek: merged.days!.map(dayNumToCode) } : undefined,
    scheduledTime: merged.alarmEnabled && merged.time ? toApiTime(merged.time) : undefined,
    startsOn: merged.startDate,
    endsOn: merged.endDate,
  };
}

// --- todo ---------------------------------------------------------------------
export function toAppTodo(td: TodoResponse): Routine {
  return {
    id: String(td.id ?? ''),
    title: td.title ?? '',
    category: td.categoryId != null ? String(td.categoryId) : undefined,
    dueDate: td.dueDate,
    kind: 'todo',
  };
}

export function toTodoCreate(
  category: string | undefined,
  title: string,
  dueDate: string,
): TodoCreateRequest {
  return {
    title,
    categoryId: toCategoryId(category),
    dueDate,
  };
}

export function toTodoUpdate(td: Routine, overrides: Partial<Routine> = {}): TodoUpdateRequest {
  const merged = { ...td, ...overrides };
  return {
    title: merged.title,
    categoryId: toCategoryId(merged.category),
    dueDate: merged.dueDate,
  };
}

// --- completion ---------------------------------------------------------------
/**
 * Build the completion log for `date` from a `/today` response: routine ids with
 * `completed`, and todo ids with status COMPLETED. The API has no "logs for an
 * arbitrary date" endpoint, so only today's completion is server-sourced.
 */
export function todayCompletions(today: TodayResponse, date: string): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const group of today.categories ?? []) {
    for (const r of group.routines ?? []) {
      if (r.completed && r.id != null) map[String(r.id)] = [date];
    }
    for (const td of group.todos ?? []) {
      if (td.status === 'COMPLETED' && td.id != null) map[String(td.id)] = [date];
    }
  }
  return map;
}

// --- wallet -------------------------------------------------------------------
// Accepts both WalletResponse (from /me/wallets) and WalletSummary (embedded in
// purchase/draw responses) — they share this shape.
type WalletLike = { currencyType?: 'COIN' | 'DIAMOND'; balance?: number };

export function toWallet(list: WalletLike[]): Wallet {
  let coin = 0;
  let dia = 0;
  for (const w of list) {
    if (w.currencyType === 'COIN') coin = w.balance ?? 0;
    else if (w.currencyType === 'DIAMOND') dia = w.balance ?? 0;
  }
  return { coin, dia };
}

// --- gacha --------------------------------------------------------------------
// The API gacha carries no preview art, so decorate machines with a rotating
// icon + accent by index (placeholder until themed art exists).
const GACHA_ICONS = ['🎁', '🏯', '🌿', '🥐', '🌙', '🧸', '🪐', '🌸'];
const GACHA_ACCENTS = ['#E8DCC8', '#D6E4D2', '#F7E6C8', '#D8D2EC', '#E6D2D2', '#D2E4E6'];

export type GachaMachine = {
  id: number;
  name: string;
  costCurrencyType: 'COIN' | 'DIAMOND';
  costAmount: number;
  drawCount: number;
  icon: string;
  accent: string;
};

export function toGachaMachine(g: GachaResponse, index = 0): GachaMachine {
  return {
    id: g.gachaId ?? 0,
    name: g.name ?? '',
    costCurrencyType: g.costCurrencyType ?? 'COIN',
    costAmount: g.costAmount ?? 0,
    drawCount: g.drawCount ?? 1,
    icon: GACHA_ICONS[index % GACHA_ICONS.length],
    accent: GACHA_ACCENTS[index % GACHA_ACCENTS.length],
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
const WALLPAPER_TINTS = ['#F3E9D6', '#E4F0DC', '#F7E4EA', '#E3EEF8', '#ECE8FA', '#F7ECD8'];

const isPositioned = (i: ItemResponse) =>
  i.placementType === 'positioned' &&
  !!i.defaultSlot &&
  VALID_SLOTS.includes(i.defaultSlot as FurnitureSlot);

/** "Forest Sage Set - Arched Window" → "Arched Window" (theme shows separately). */
const stripSetPrefix = (name?: string) => (name ?? '').replace(/^.*?Set\s*-\s*/, '');

export function toFurnitureItem(item: ItemResponse): FurnitureItem {
  return {
    id: String(item.id ?? ''),
    name: stripSetPrefix(item.name),
    slot: (item.defaultSlot as FurnitureSlot) ?? 'topLeft',
    category: CATEGORY_LABEL[item.categoryCode ?? ''] ?? '장식',
    price: item.priceAmount ?? 0,
    assetKey: item.assetKey ?? '',
    theme: item.theme?.name,
  };
}

export function toWallpaper(item: ItemResponse, index = 0): Wallpaper {
  return {
    id: String(item.id ?? ''),
    name: stripSetPrefix(item.name),
    price: item.priceAmount ?? 0,
    assetKey: item.assetKey ?? '',
    color: WALLPAPER_TINTS[index % WALLPAPER_TINTS.length],
    theme: item.theme?.name,
  };
}

export type ShopCatalogue = {
  furniture: FurnitureItem[];
  wallpapers: Wallpaper[];
  ownedIds: string[];
};

export function toShopCatalogue(items: ItemResponse[]): ShopCatalogue {
  return {
    furniture: items.filter(isPositioned).map(toFurnitureItem),
    wallpapers: items
      .filter((i) => i.categoryCode === 'wallpaper')
      .map((i, idx) => toWallpaper(i, idx)),
    ownedIds: items.filter((i) => i.owned).map((i) => String(i.id)),
  };
}

/**
 * A starting room built from owned items: one owned item per slot plus an owned
 * wallpaper. Avoids an empty room while server-side placement isn't wired.
 */
export function ownedPlacement(cat: ShopCatalogue): {
  placedFurnitureIds: string[];
  wallpaperId: string;
} {
  const owned = new Set(cat.ownedIds);
  const bySlot: Partial<Record<FurnitureSlot, string>> = {};
  for (const f of cat.furniture) if (owned.has(f.id) && !bySlot[f.slot]) bySlot[f.slot] = f.id;
  const wp = cat.wallpapers.find((w) => owned.has(w.id));
  return {
    placedFurnitureIds: Object.values(bySlot),
    wallpaperId: wp?.id ?? cat.wallpapers[0]?.id ?? DEFAULT_WALLPAPER_ID,
  };
}

// ---------- Onboarding ----------

// Decorations for server master goals: match by code against the local goal
// list's look, otherwise cycle a fallback palette (master has no art yet).
const GOAL_DECOR: Record<string, { emoji: string; bg: string }> = {
  exercise: { emoji: '🏃', bg: '#E4F0DC' },
  study: { emoji: '📖', bg: '#E3EEF8' },
  sleep: { emoji: '🌙', bg: '#ECE8FA' },
  reading: { emoji: '📚', bg: '#F7E4EA' },
  organizing: { emoji: '🧹', bg: '#F7ECD8' },
  career: { emoji: '💼', bg: '#DDF3F0' },
  habit: { emoji: '✨', bg: '#FFF0D8' },
};

const GOAL_FALLBACK_DECOR = [
  { emoji: '🎯', bg: '#E4F0DC' },
  { emoji: '🌱', bg: '#E3EEF8' },
  { emoji: '⭐', bg: '#ECE8FA' },
  { emoji: '🔥', bg: '#F7E4EA' },
  { emoji: '💪', bg: '#F7ECD8' },
];

/** Server goal master → onboarding survey option (id is the numeric id stringified). */
export function toOnboardingGoal(g: GoalItem, index: number): OnboardingGoal {
  const decor =
    (g.code && GOAL_DECOR[g.code]) || GOAL_FALLBACK_DECOR[index % GOAL_FALLBACK_DECOR.length];
  return {
    id: String(g.id ?? index),
    label: g.name ?? g.code ?? '목표',
    emoji: decor.emoji,
    bg: decor.bg,
  };
}

// App character ids double as server character codes (bear/otter/sheep/…), so
// mapping is a code match against the /characters master.

/** Server selectedCharacterId → app CharacterId (undefined if the code has no app art). */
export function toAppCharacterId(
  serverId: number,
  masters: CharacterItem[],
): CharacterId | undefined {
  const code = masters.find((m) => m.id === serverId)?.code;
  return CHARACTER_OPTIONS.find((o) => o.id === code)?.id;
}

/** App CharacterId → server character id (undefined if the server has no such code). */
export function toServerCharacterId(
  appId: CharacterId,
  masters: CharacterItem[],
): number | undefined {
  return masters.find((m) => m.code === appId)?.id;
}

// --- house (그룹하우스) ---------------------------------------------------------

// Room tile tints + browse-card decorations, cycled by index (no art yet).
const ROOM_TINTS = ['#F5E1D8', '#D9E8D4', '#F5E8C8', '#E4DCF0', '#FBE0D8', '#D8E8F0'];
const HOUSE_EMOJIS = ['🏡', '🌅', '💻', '📚', '🏋️', '🎨', '🌙', '☕'];
const HOUSE_BGS = ['#FFEFD8', '#E4F0DC', '#E3EEF8', '#F7E4EA', '#ECE8FA', '#F7ECD8'];
const HOUSE_BORDERS = ['#F0C88A', '#A8C898', '#9FBEDD', '#DBA8BC', '#B7A8DD', '#DDC08A'];
const MY_ROOM_TINT = '#E8E0D0';

/**
 * Build the group-house screen model from house detail + members. Rooms are
 * laid out two per floor, top floor first, with my room on the bottom floor
 * (mirrors the prototype layout).
 */
export function toGroupHouse(
  detail: HouseDetailResponse,
  members: MemberSummary[],
  myUserId?: number,
): House {
  const active = members.filter((m) => m.status !== 'LEFT');
  // Others first, me last → my room lands on the bottom floor.
  const ordered = [
    ...active.filter((m) => m.userId !== myUserId),
    ...active.filter((m) => m.userId === myUserId),
  ];
  const cells: RoomCell[] = ordered.map((m, i) => ({
    name: m.nickname || `멤버 ${m.userId ?? i + 1}`,
    color: m.userId === myUserId ? MY_ROOM_TINT : ROOM_TINTS[i % ROOM_TINTS.length],
    isMine: m.userId === myUserId,
    membershipId: m.membershipId,
  }));
  const floorCount = Math.max(1, Math.ceil(cells.length / 2));
  const floors: Floor[] = [];
  for (let f = 0; f < floorCount; f++) {
    floors.push({
      level: `${floorCount - f}층`,
      rooms: cells.slice(f * 2, f * 2 + 2),
    });
  }
  return {
    houseId: detail.houseId,
    title: detail.name ?? '',
    inviteCode: detail.inviteCode ?? undefined,
    myRole: detail.myRole,
    floors,
  };
}

/** Browse-list card model from the API house summary (decorations cycled). */
export function toSearchHouse(h: HouseSummary, index = 0): SearchHouse {
  return {
    id: String(h.houseId ?? ''),
    name: h.name ?? '',
    members: h.currentMemberCount ?? 0,
    capacity: h.maxMembers ?? 0,
    tag: h.goals?.[0]?.name ?? '루틴',
    emoji: HOUSE_EMOJIS[index % HOUSE_EMOJIS.length],
    bg: HOUSE_BGS[index % HOUSE_BGS.length],
    border: HOUSE_BORDERS[index % HOUSE_BORDERS.length],
    description: `레벨 ${h.level ?? 0} 하우스 · 함께 루틴을 키워요`,
  };
}
