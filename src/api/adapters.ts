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
  type RepeatKind,
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
import type { FriendActivityDay, GuestbookEntry } from '@/components/screens/friend-room-screen';
import { isPictogramName, type PictogramName } from '@/components/ui/pictograms';
import type { HousePreview, SearchHouse } from '@/components/screens/house-search-screen';
import type { CalendarDayItem } from '@/components/screens/my-room-screen';
import type { NotificationEntry } from '@/components/screens/notification-list-screen';
import type { OwnedCharacter } from '@/components/screens/sheets/character-picker-sheet';

import type {
  CalendarDayResponse,
  CategoryCreateRequest,
  GuestbookItem,
  MyCharacterItem,
  MyItemSummary,
  RoomSlotResponse,
  CharacterItem,
  CategoryResponse,
  GachaResponse,
  GoalItem,
  HouseDetailResponse,
  HouseMemberDayResponse,
  HouseMemberRoutineCompletionListResponse,
  HousePreviewResponse,
  HouseSummary,
  ItemResponse,
  MemberSummary,
  MissionSummary,
  NotificationItem,
  RepeatDays,
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
// 1:1 with the API's four levels: 공개(public)↔PUBLIC, 이웃 공개(neighbor)↔HOUSE,
// 일부 공개(partial)↔FRIENDS, 비공개(private)↔PRIVATE.
const visToApp = (v?: 'PRIVATE' | 'FRIENDS' | 'HOUSE' | 'PUBLIC'): CategoryVisibility =>
  v === 'PUBLIC' ? 'public' : v === 'HOUSE' ? 'neighbor' : v === 'FRIENDS' ? 'partial' : 'private';
const visToApi = (v: CategoryVisibility): 'PRIVATE' | 'FRIENDS' | 'HOUSE' | 'PUBLIC' =>
  v === 'public' ? 'PUBLIC' : v === 'neighbor' ? 'HOUSE' : v === 'partial' ? 'FRIENDS' : 'PRIVATE';

// --- category -----------------------------------------------------------------
// Categories created before the pictogram switch stored the picker emoji as
// their iconKey — map those to the equivalent pictogram so old accounts keep
// their icons. New categories store the pictogram name directly.
const LEGACY_EMOJI_ICONS: Record<string, PictogramName> = {
  '🗓': 'calendar',
  '📚': 'book',
  '🎨': 'palette',
  '💪': 'dumbbell',
  '✨': 'sparkle',
  '☀': 'sun',
  '🌙': 'moon',
  '💧': 'water',
  '🏃': 'run',
  '💖': 'heart',
  '☕': 'coffee',
  '🎵': 'music',
  '🍳': 'cooking',
  '🧘': 'meditation',
  '💼': 'briefcase',
  '🌱': 'sprout',
};

/** Server iconKey (pictogram name / legacy emoji / asset key) → pictogram. */
function toCategoryIcon(iconKey?: string): PictogramName {
  if (!iconKey) return 'sparkle';
  if (isPictogramName(iconKey)) return iconKey;
  // Emoji lookups ignore the variation selector (🗓️ vs 🗓).
  return LEGACY_EMOJI_ICONS[iconKey.replace(/️/g, '')] ?? 'sparkle';
}

export function toAppCategory(c: CategoryResponse, index = 0): RoutineCategoryMeta {
  return {
    id: String(c.id ?? ''),
    label: c.name ?? '',
    icon: toCategoryIcon(c.iconKey),
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
    iconKey: cat.icon,
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

// Repeat cadence ↔ the API's repeatType. Legacy app payloads may omit
// `repeat` — days present means weekly, absent means daily.
const REPEAT_TO_API: Record<RepeatKind, string> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  biweekly: 'BIWEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
};
const REPEAT_TO_APP: Record<string, RepeatKind> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

const effectiveRepeat = (r: { repeat?: RepeatKind; days?: number[] }): RepeatKind =>
  r.repeat ?? (r.days && r.days.length ? 'weekly' : 'daily');

/** repeatType + repeatDays request fields from an app-side repeat description. */
function toApiRepeat(r: {
  repeat?: RepeatKind;
  days?: number[];
  dayOfMonth?: number;
  month?: number;
}): { repeatType: string; repeatDays: RepeatDays | undefined } {
  const kind = effectiveRepeat(r);
  const repeatDays =
    kind === 'weekly' || kind === 'biweekly'
      ? { daysOfWeek: (r.days ?? []).map(dayNumToCode) }
      : kind === 'monthly'
        ? { dayOfMonth: r.dayOfMonth }
        : kind === 'yearly'
          ? { month: r.month, day: r.dayOfMonth }
          : undefined;
  return { repeatType: REPEAT_TO_API[kind], repeatDays };
}

export function toAppRoutine(r: RoutineResponse): Routine {
  const kind = REPEAT_TO_APP[r.repeatType ?? ''] ?? 'daily';
  const hasDays = kind === 'weekly' || kind === 'biweekly';
  return {
    id: routineAppId(r.id),
    title: r.title ?? '',
    category: r.categoryId != null ? String(r.categoryId) : undefined,
    photoVerify: r.authType === 'PHOTO',
    repeat: kind,
    days:
      hasDays && r.repeatDays?.daysOfWeek
        ? r.repeatDays.daysOfWeek.map(dayCodeToNum).filter((n) => n >= 0)
        : undefined,
    // The API names the yearly day `day` and the monthly one `dayOfMonth`;
    // the app folds both into `dayOfMonth`.
    dayOfMonth:
      kind === 'monthly'
        ? r.repeatDays?.dayOfMonth
        : kind === 'yearly'
          ? r.repeatDays?.day
          : undefined,
    month: kind === 'yearly' ? r.repeatDays?.month : undefined,
    startDate: r.startsOn,
    endDate: r.endsOn,
    alarmEnabled: !!r.scheduledTime,
    time: r.scheduledTime ? fromApiTime(r.scheduledTime) : undefined,
    kind: 'routine',
  };
}

export function toRoutineCreate(n: NewRoutine): RoutineCreateRequest {
  const { repeatType, repeatDays } = toApiRepeat(n);
  return {
    title: n.title,
    categoryId: toCategoryId(n.category),
    authType: n.photoVerify ? 'PHOTO' : 'CHECK',
    repeatType,
    repeatDays,
    scheduledTime: n.alarmEnabled && n.time ? toApiTime(n.time) : undefined,
    startsOn: n.startDate,
    endsOn: n.endDate,
  };
}

/**
 * Build a full update body from the current app routine plus overrides. PUT
 * replaces the resource, so we always send the complete representation —
 * cleared optionals go as explicit null so the server unsets them (turning an
 * alarm off or removing the 종료일 must actually stick).
 */
export function toRoutineUpdate(
  r: Routine,
  overrides: Partial<Routine> = {},
): RoutineUpdateRequest {
  const merged = { ...r, ...overrides };
  const { repeatType, repeatDays } = toApiRepeat(merged);
  return {
    title: merged.title,
    categoryId: toCategoryId(merged.category),
    authType: merged.photoVerify ? 'PHOTO' : 'CHECK',
    repeatType,
    // DAILY has no repeatDays — send null so a WEEKLY→DAILY edit clears them.
    repeatDays: repeatDays ?? null,
    scheduledTime: merged.alarmEnabled && merged.time ? toApiTime(merged.time) : null,
    startsOn: merged.startDate,
    endsOn: merged.endDate ?? null,
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
const GACHA_ACCENTS = ['#E8DCC8', '#D6E4D2', '#F7E6C8', '#D8D2EC', '#E6D2D2', '#D2E4E6'];

export type GachaMachine = {
  id: number;
  name: string;
  costCurrencyType: 'COIN' | 'DIAMOND';
  costAmount: number;
  drawCount: number;
  icon: PictogramName;
  accent: string;
  /** Selector row grouping — themed machines drop furniture, the rest characters. */
  kind: 'furniture' | 'character';
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
    // Furniture gachas draw from a room theme; the character gacha has none.
    kind: g.themeId == null ? 'character' : 'furniture',
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

function toFurnitureItem(item: ItemResponse): FurnitureItem {
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

function toWallpaper(item: ItemResponse, index = 0): Wallpaper {
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
const HOUSE_ICONS: PictogramName[] = [
  'house',
  'sunrise',
  'laptop',
  'book',
  'dumbbell',
  'palette',
  'moon',
  'coffee',
];
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
    level: detail.level ?? 0,
    floors,
    missions,
    description: detail.description ?? undefined,
    maxMembers: detail.maxMembers ?? undefined,
    memberCount: detail.currentMemberCount ?? active.length,
  };
}

// Mission-type presentation: emoji + the label shown under the progress bar.
const MISSION_TYPE_META: Record<string, { icon: PictogramName; label: string }> = {
  DAILY_MEMBER_RATE: { icon: 'sun', label: '일일 구성원 달성률' },
  WEEKLY_MEMBER_COUNT: { icon: 'calendar', label: '주간 구성원 달성 횟수' },
  STREAK_DAYS: { icon: 'sparkle', label: '연속 달성' },
};

/** House-mission card model from the API mission summary. */
export function toHouseMission(m: MissionSummary): HouseMission {
  const meta = MISSION_TYPE_META[m.missionType ?? ''] ?? { icon: 'target', label: '단체 미션' };
  const target = m.targetValue ?? 0;
  return {
    id: m.missionId ?? 0,
    title: m.title ?? '',
    desc: meta.label,
    icon: meta.icon,
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

/** Notification → 알림 list row (date shown as "M월 D일"). */
export function toNotificationEntry(n: NotificationItem): NotificationEntry {
  const d = n.createdAt ? new Date(n.createdAt) : null;
  return {
    id: n.notificationId ?? 0,
    type: n.type,
    title: n.title ?? '알림',
    body: n.body ?? '',
    read: n.isRead === true,
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
    icon: HOUSE_ICONS[index % HOUSE_ICONS.length],
    bg: HOUSE_BGS[index % HOUSE_BGS.length],
    border: HOUSE_BORDERS[index % HOUSE_BORDERS.length],
    // No description: the boilerplate one only ever truncated (#234); the
    // level rides the meta line instead. Server summaries carry no intro text.
    level: h.level ?? 0,
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
 * A friend's room slots → app placement. Their userItemIds mean nothing to us
 * (we only hold our own inventory), so items resolve by assetKey against the
 * shared catalogue instead. Entries without a catalogue match are skipped.
 */
export function fromFriendRoomSlots(
  slots: RoomSlotResponse[],
  cat: ShopCatalogue,
): {
  placedFurnitureIds: string[];
  wallpaperId: string | null;
  floorId: string | null;
  backgroundId: string | null;
} {
  const byAsset = (list: { id: string; assetKey?: string }[], key: string) =>
    list.find((i) => i.assetKey && i.assetKey === key)?.id ?? null;
  const placed: string[] = [];
  let wallpaperId: string | null = null;
  let floorId: string | null = null;
  let backgroundId: string | null = null;
  for (const s of slots) {
    if (!s.assetKey || !s.slotType) continue;
    if (s.slotType === 'wallpaper') {
      wallpaperId = byAsset(cat.wallpapers, s.assetKey) ?? wallpaperId;
    } else if (s.slotType === 'floor') {
      floorId = byAsset(cat.floors, s.assetKey) ?? floorId;
    } else if (s.slotType === 'background') {
      backgroundId = byAsset(cat.backgrounds, s.assetKey) ?? backgroundId;
    } else if ((POSITIONED_SLOTS as string[]).includes(s.slotType)) {
      const id = byAsset(cat.furniture, s.assetKey);
      if (id) placed.push(id);
    }
  }
  return { placedFurnitureIds: placed, wallpaperId, floorId, backgroundId };
}

/** Room character code (e.g. "cat") → app CharacterId, when the code exists app-side. */
export function characterIdFromCode(code?: string): CharacterId | undefined {
  return CHARACTER_OPTIONS.find((o) => o.id === code)?.id;
}

/**
 * Owned character (GET /me/characters) → picker model. Characters whose code
 * has no local sprite art drop out (they can't render yet) — null result.
 * Known limit: if the SERVER-selected character is such a code, the room falls
 * back to the onboarding pick until #263 (CDN room rendering) lands.
 */
export function toOwnedCharacter(c: MyCharacterItem): OwnedCharacter | null {
  const id = characterIdFromCode(c.code);
  if (!id || c.characterId == null) return null;
  const meta = CHARACTER_OPTIONS.find((o) => o.id === id);
  return {
    serverId: c.characterId,
    id,
    name: c.name || meta?.name || '',
    assetKey: c.baseAssetKey,
    selected: c.selected === true,
  };
}

/**
 * A member's day (GET …/members/{id}/day) → the friend-room routine list:
 * routines first (server order: scheduled time asc), then todos. Uses the
 * read-only `completed` flag — visitors can't toggle a friend's items.
 */
export function toFriendRoutines(day: HouseMemberDayResponse): Routine[] {
  const routines = (day.routines ?? []).map((r): Routine => ({
    // originRoutineId is the stable lineage id; version ids change on edit.
    id: String(r.originRoutineId ?? r.id ?? ''),
    title: r.title ?? '루틴',
    kind: 'routine',
    completed: r.completed === true,
    time: r.scheduledTime ? r.scheduledTime.slice(0, 5) : undefined,
    alarmEnabled: !!r.scheduledTime,
    photoVerify: r.authType === 'PHOTO',
  }));
  const todos = (day.todos ?? []).map((t): Routine => ({
    id: `todo-${t.id ?? ''}`,
    title: t.title ?? '할 일',
    kind: 'todo',
    completed: t.status === 'COMPLETED',
  }));
  return [...routines, ...todos];
}

/**
 * Completion history (GET …/routine-completions) → per-day rows for the
 * friend-room 최근 활동 list. The server already sorts date desc; rows keep
 * that order, each with a "M월 D일" label and the day's completed titles.
 */
export function toFriendActivity(
  resp: HouseMemberRoutineCompletionListResponse,
): FriendActivityDay[] {
  const days: FriendActivityDay[] = [];
  for (const c of resp.items ?? []) {
    const date = c.routineDate ?? '';
    if (!date) continue;
    let day = days[days.length - 1];
    if (!day || day.date !== date) {
      const [, m, d] = date.split('-').map(Number);
      day = { date, label: `${m}월 ${d}일`, titles: [] };
      days.push(day);
    }
    day.titles.push(c.title ?? '루틴');
  }
  return days;
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
