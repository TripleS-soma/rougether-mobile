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
import { type RoomSlotSave } from './rooms';

import type { Floor, House, HouseMission, RoomCell } from '@/components/screens/group-house-screen';
import type { GuestbookEntry } from '@/components/screens/friend-room-screen';
import type { HousePreview, SearchHouse } from '@/components/screens/house-search-screen';
import type { CalendarDayItem } from '@/components/screens/my-room-screen';

import type {
  CalendarDayResponse,
  CategoryCreateRequest,
  GuestbookItem,
  MyItemSummary,
  RoomSlotResponse,
  CharacterItem,
  CategoryResponse,
  GachaResponse,
  GoalItem,
  HouseDetailResponse,
  HousePreviewResponse,
  HouseSummary,
  ItemResponse,
  MemberSummary,
  MissionSummary,
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
    deleted: c.deleted || undefined,
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
// Routine and todo server ids live in separate sequences, so a routine and a
// todo can share the same number. App ids are prefixed by kind ("r12"/"t12") —
// the merged routines list, the completions map, and per-row lookups all key
// on the app id, and a collision cross-wires them (kebab menu opening the
// wrong item, a todo check marking a routine done).
const routineAppId = (id?: number) => `r${id ?? ''}`;
const todoAppId = (id?: number) => `t${id ?? ''}`;

/** App item id ("r12"/"t12") → numeric server id for API paths. */
export const toServerItemId = (id: string) => Number(id.replace(/^[rt]/, ''));

export function toAppRoutine(r: RoutineResponse): Routine {
  const isWeekly = r.repeatType === 'WEEKLY';
  return {
    id: routineAppId(r.id),
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
    id: todoAppId(td.id),
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
/**
 * /calendar day → flat list for the 달력 tab. Groups carry only categoryId —
 * resolve name/color against /categories?includeDeleted=true so records under
 * a deleted category still show as their original category.
 */
export function toCalendarItems(day: CalendarDayResponse): CalendarDayItem[] {
  const items: CalendarDayItem[] = [];
  for (const g of day.categories ?? []) {
    const category = g.categoryId != null ? String(g.categoryId) : undefined;
    for (const r of g.routines ?? []) {
      items.push({
        id: routineAppId(r.id),
        kind: 'routine',
        title: r.title ?? '',
        time: r.scheduledTime ? fromApiTime(r.scheduledTime) : undefined,
        completed: !!r.completed,
        category,
      });
    }
    for (const td of g.todos ?? []) {
      items.push({
        id: todoAppId(td.id),
        kind: 'todo',
        title: td.title ?? '',
        completed: td.status === 'COMPLETED',
        category,
      });
    }
  }
  return items;
}

export function todayCompletions(today: TodayResponse, date: string): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const group of today.categories ?? []) {
    for (const r of group.routines ?? []) {
      if (r.completed && r.id != null) map[routineAppId(r.id)] = [date];
    }
    for (const td of group.todos ?? []) {
      if (td.status === 'COMPLETED' && td.id != null) map[todoAppId(td.id)] = [date];
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
  /** Floor/background surfaces (categoryCode floor/background) — single-select like wallpaper. */
  floors: Wallpaper[];
  backgrounds: Wallpaper[];
  ownedIds: string[];
};

// Surface items share the wallpaper shape: one per room surface slot.
const bySurfaceCategory = (items: ItemResponse[], categoryCode: string) =>
  items.filter((i) => i.categoryCode === categoryCode).map((i, idx) => toWallpaper(i, idx));

export function toShopCatalogue(items: ItemResponse[]): ShopCatalogue {
  return {
    furniture: items.filter(isPositioned).map(toFurnitureItem),
    wallpapers: bySurfaceCategory(items, 'wallpaper'),
    floors: bySurfaceCategory(items, 'floor'),
    backgrounds: bySurfaceCategory(items, 'background'),
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
  floorId: string | null;
  backgroundId: string | null;
} {
  const owned = new Set(cat.ownedIds);
  const bySlot: Partial<Record<FurnitureSlot, string>> = {};
  for (const f of cat.furniture) if (owned.has(f.id) && !bySlot[f.slot]) bySlot[f.slot] = f.id;
  const wp = cat.wallpapers.find((w) => owned.has(w.id));
  return {
    placedFurnitureIds: Object.values(bySlot),
    wallpaperId: wp?.id ?? cat.wallpapers[0]?.id ?? DEFAULT_WALLPAPER_ID,
    floorId: cat.floors.find((f) => owned.has(f.id))?.id ?? null,
    backgroundId: cat.backgrounds.find((b) => owned.has(b.id))?.id ?? null,
  };
}

// ---------- Onboarding ----------

/** Server goal master → onboarding survey option (id is the numeric id stringified). */
export function toOnboardingGoal(g: GoalItem, index: number): OnboardingGoal {
  return {
    id: String(g.id ?? index),
    label: g.name ?? g.code ?? '목표',
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
  myNickname?: string,
  missions?: HouseMission[],
): House {
  const active = members.filter((m) => m.status !== 'LEFT');
  // Others first, me last → my room lands on the bottom floor.
  const ordered = [
    ...active.filter((m) => m.userId !== myUserId),
    ...active.filter((m) => m.userId === myUserId),
  ];
  const cells: RoomCell[] = ordered.map((m, i) => ({
    // The members API may not carry my nickname (server nickname unset) — fall
    // back to the profile nickname so my room reads by name, not '멤버 N'.
    name:
      m.nickname ||
      (m.userId === myUserId && myNickname ? myNickname : `멤버 ${m.userId ?? i + 1}`),
    color: m.userId === myUserId ? MY_ROOM_TINT : ROOM_TINTS[i % ROOM_TINTS.length],
    isMine: m.userId === myUserId,
    isOwner: m.role === 'OWNER',
    membershipId: m.membershipId,
    userId: m.userId,
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
    missions,
    description: detail.description ?? undefined,
    maxMembers: detail.maxMembers ?? undefined,
    memberCount: detail.currentMemberCount ?? active.length,
  };
}

// Mission-type presentation: emoji + the label shown under the progress bar.
const MISSION_TYPE_META: Record<string, { emoji: string; label: string }> = {
  DAILY_MEMBER_RATE: { emoji: '☀️', label: '일일 구성원 달성률' },
  WEEKLY_MEMBER_COUNT: { emoji: '📅', label: '주간 구성원 달성 횟수' },
  STREAK_DAYS: { emoji: '🔥', label: '연속 달성' },
};

/** House-mission card model from the API mission summary. */
export function toHouseMission(m: MissionSummary): HouseMission {
  const meta = MISSION_TYPE_META[m.missionType ?? ''] ?? { emoji: '🎯', label: '단체 미션' };
  const target = m.targetValue ?? 0;
  return {
    id: m.missionId ?? 0,
    title: m.title ?? '',
    desc: meta.label,
    emoji: meta.emoji,
    current: m.currentValue ?? 0,
    target: Math.max(1, target),
    status: m.status ?? 'ACTIVE',
    achieved: target > 0 && (m.currentValue ?? 0) >= target,
  };
}

/** Invite-code lookup → pre-join preview card model. */
export function toHousePreview(p: HousePreviewResponse): HousePreview {
  return {
    name: p.name ?? '',
    members: p.currentMemberCount ?? 0,
    capacity: p.maxMembers ?? undefined,
    expired: p.inviteExpired ?? false,
  };
}

/** Guestbook note → friend-room list entry (date shown as "M월 D일"). */
export function toGuestbookEntry(g: GuestbookItem): GuestbookEntry {
  const d = g.createdAt ? new Date(g.createdAt) : null;
  return {
    id: String(g.guestbookId ?? ''),
    author: g.authorNickname || `멤버 ${g.authorId ?? ''}`,
    content: g.content ?? '',
    date: d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : '',
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

// --- room placement (배치 저장) --------------------------------------------------

const POSITIONED_SLOTS: FurnitureSlot[] = [
  'topLeft',
  'topCenter',
  'topRight',
  'midLeft',
  'midRight',
  'bottomLeft',
  'bottomCenter',
  'bottomRight',
];

/** Inventory → itemId(string) → userItemId map (placement saves need userItemId). */
export function toUserItemMap(items: MyItemSummary[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const it of items)
    if (it.itemId != null && it.userItemId != null) map.set(String(it.itemId), it.userItemId);
  return map;
}

/** Server room slots → app placement. Unknown/unowned entries are skipped. */
export function fromRoomSlots(
  slots: RoomSlotResponse[],
  cat: ShopCatalogue,
  userItemMap: Map<string, number>,
): {
  placedFurnitureIds: string[];
  wallpaperId: string | null;
  floorId: string | null;
  backgroundId: string | null;
} {
  const itemByUserItem = new Map<number, string>();
  for (const [itemId, uid] of userItemMap) itemByUserItem.set(uid, itemId);
  const placed: string[] = [];
  let wallpaperId: string | null = null;
  let floorId: string | null = null;
  let backgroundId: string | null = null;
  for (const s of slots) {
    if (s.userItemId == null || !s.slotType) continue;
    const itemId = itemByUserItem.get(s.userItemId);
    if (!itemId) continue;
    if (s.slotType === 'wallpaper') {
      if (cat.wallpapers.some((w) => w.id === itemId)) wallpaperId = itemId;
    } else if (s.slotType === 'floor') {
      if (cat.floors.some((f) => f.id === itemId)) floorId = itemId;
    } else if (s.slotType === 'background') {
      if (cat.backgrounds.some((b) => b.id === itemId)) backgroundId = itemId;
    } else if ((POSITIONED_SLOTS as string[]).includes(s.slotType)) {
      if (cat.furniture.some((f) => f.id === itemId)) placed.push(itemId);
    }
  }
  return { placedFurnitureIds: placed, wallpaperId, floorId, backgroundId };
}

/**
 * App placement → the full slot layout for PUT /rooms/me/slots. Every
 * positioned slot (+ wallpaper) is sent each save — null clears — so the
 * server always mirrors the client exactly.
 */
export function toSlotSaves(
  placedIds: string[],
  wallpaperId: string,
  cat: ShopCatalogue,
  userItemMap: Map<string, number>,
  floorId?: string | null,
  backgroundId?: string | null,
): RoomSlotSave[] {
  const bySlot: Partial<Record<FurnitureSlot, number>> = {};
  for (const id of placedIds) {
    const item = cat.furniture.find((f) => f.id === id);
    const uid = userItemMap.get(id);
    if (item && uid != null && bySlot[item.slot] == null) bySlot[item.slot] = uid;
  }
  const saves: RoomSlotSave[] = POSITIONED_SLOTS.map((s) => ({
    slotType: s,
    userItemId: bySlot[s] ?? null,
  }));
  saves.push({ slotType: 'wallpaper', userItemId: userItemMap.get(wallpaperId) ?? null });
  saves.push({ slotType: 'floor', userItemId: (floorId && userItemMap.get(floorId)) || null });
  saves.push({
    slotType: 'background',
    userItemId: (backgroundId && userItemMap.get(backgroundId)) || null,
  });
  return saves;
}
