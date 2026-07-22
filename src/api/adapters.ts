/**
 * Mapping between the API's wire types (`./types`) and the app's domain models
 * (`@/constants/routines`, `@/constants/currency`). The app uses string ids
 * (the API's numeric id stringified), 0–6 weekday numbers (0 = Sun), and
 * "HH:MM" times; the API uses numeric ids, MON–SUN day codes, and "HH:mm:ss".
 */
import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';
import { type Wallet } from '@/constants/currency';
import {
  GachaAccents,
  HouseBgs,
  HouseBorders,
  MyRoomTint,
  RoomTints,
  WallpaperTints,
} from '@/constants/theme';
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
  type PlacedFurniture,
  type Wallpaper,
} from '@/resources/furniture';

import { type OnboardingGoal } from '@/components/screens/onboarding-screen';
import { toIsoDate } from '@/utils/datetime';
import { type RoomPlacementSave, type RoomPlacementWire, type RoomSlotSave } from './rooms';

import type { HouseCover } from '@/components/house-cover-picker';
import type {
  Floor,
  House,
  HouseMission,
  MemberRoomPreview,
  RoomCell,
} from '@/components/screens/group-house-screen';
import type { FriendActivityDay, GuestbookEntry } from '@/components/screens/friend-room-screen';
import { isPictogramName, type PictogramName } from '@/components/ui/pictograms';
import type {
  HousePreview,
  HousePreviewDetail,
  SearchHouse,
} from '@/components/screens/house-search-screen';

import type { CalendarDayItem } from '@/components/screens/my-room-screen';
import type { NotificationEntry } from '@/components/screens/notification-list-screen';
import type { OwnedCharacter } from '@/components/screens/sheets/character-picker-sheet';

import type {
  CalendarDayResponse,
  CategoryCreateRequest,
  GuestbookItem,
  MyCharacterItem,
  MyItemSummary,
  RoomResponse,
  RoomSlotResponse,
  CharacterItem,
  CategoryResponse,
  GachaResponse,
  GoalItem,
  HouseCoverImage,
  HouseDetailResponse,
  HouseMemberDayResponse,
  HouseMemberRoutineCompletionListResponse,
  HousePreviewDetailResponse,
  PreviewMemberRoom,
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
    // 마감 시각(dueTime) — 루틴의 알림 시간과 같은 자리(time)에 얹어 배지와
    // 시간 시트가 그대로 동작한다 (#325).
    time: td.dueTime ? fromApiTime(td.dueTime) : undefined,
    alarmEnabled: !!td.dueTime,
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
    // dueTime 해제는 서버 미지원(null = 기존 값 유지, 2026-07-20 실호출 확인) —
    // 값이 있을 때만 보낸다 (#325).
    dueTime: merged.alarmEnabled && merged.time ? toApiTime(merged.time) : undefined,
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
        time: td.dueTime ? fromApiTime(td.dueTime) : undefined,
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
    accent: GachaAccents[index % GachaAccents.length],
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

/**
 * Build the group-house screen model from house detail + members. The grid is
 * sized by the house capacity (not the headcount): rooms fill two per floor
 * from the bottom-left — my room first, then the others in join order — and
 * the yet-unfilled seats render as quiet vacant tiles on the upper floors.
 */
export function toGroupHouse(
  detail: HouseDetailResponse,
  members: MemberSummary[],
  myUserId?: number,
  myNickname?: string,
  missions?: HouseMission[],
): House {
  const active = members.filter((m) => m.status !== 'LEFT');
  // Me first → my room lands on the bottom-left seat.
  const ordered = [
    ...active.filter((m) => m.userId === myUserId),
    ...active.filter((m) => m.userId !== myUserId),
  ];
  const cells: RoomCell[] = ordered.map((m, i) => ({
    // The members API may not carry my nickname (server nickname unset) — fall
    // back to the profile nickname so my room reads by name, not '멤버 N'.
    name:
      m.nickname ||
      (m.userId === myUserId && myNickname ? myNickname : `멤버 ${m.userId ?? i + 1}`),
    color: m.userId === myUserId ? MyRoomTint : RoomTints[i % RoomTints.length],
    isMine: m.userId === myUserId,
    isOwner: m.role === 'OWNER',
    membershipId: m.membershipId,
    userId: m.userId,
  }));
  // Pad to the capacity so the house always shows 정원 seats; the server keeps
  // maxMembers >= headcount, but clamp anyway so a stale detail can't drop rooms.
  const seats = Math.max(cells.length, detail.maxMembers ?? 0);
  for (let i = cells.length; i < seats; i++) {
    cells.push({ name: '빈방', color: 'transparent', vacant: true });
  }
  const floorCount = Math.max(1, Math.ceil(cells.length / 2));
  const floors: Floor[] = [];
  // cells[0] is the 1층 왼쪽 seat; the screen renders top floor first.
  for (let f = floorCount - 1; f >= 0; f--) {
    floors.push({
      level: `${f + 1}층`,
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
    coverImageKey: detail.coverImageKey ?? undefined,
    growthPoints: detail.growthPoints ?? undefined,
  };
}

/**
 * Cover catalog entry (GET /houses/cover-images) → picker model. Entries
 * without a key can't render or be submitted — null result.
 */
export function toHouseCover(c: HouseCoverImage): HouseCover | null {
  if (!c.coverImageKey) return null;
  return {
    code: c.code ?? c.coverImageKey,
    name: c.name ?? '',
    coverImageKey: c.coverImageKey,
  };
}

// Mission-type presentation: emoji + the label shown under the progress bar.
const MISSION_TYPE_META: Record<string, { icon: PictogramName; label: string }> = {
  DAILY_MEMBER_RATE: { icon: 'sun', label: '일일 구성원 달성률' },
  WEEKLY_MEMBER_COUNT: { icon: 'calendar', label: '주간 구성원 달성 횟수' },
  STREAK_DAYS: { icon: 'sparkle', label: '연속 달성' },
};

/** House-mission card model from the API mission summary. */
/** Server date-time → device-local "YYYY-MM-DD" (mission period display). */
function localDateOf(dateTime: string): string | undefined {
  const d = new Date(dateTime);
  return Number.isNaN(d.getTime()) ? undefined : toIsoDate(d);
}

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
    endsOn: m.endsAt ? localDateOf(m.endsAt) : undefined,
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
/**
 * 미리보기 memberRooms 항목 → 창문 타일 렌더 모델 (#386) — 집 화면 멤버 방과
 * 같은 변환(assetKey를 카탈로그로 역해석). room이 null(방 미생성)이면 집
 * 화면의 목업과 같은 기본 빈 방을 그린다.
 */
function toPreviewRoom(
  room: RoomResponse | null | undefined,
  cat: ShopCatalogue,
): MemberRoomPreview {
  if (!room) return { placedFurnitureIds: [], placements: [] };
  const placement = fromFriendRoomSlots(room.slots ?? [], cat);
  return {
    placedFurnitureIds: placement.placedFurnitureIds,
    placements:
      room.layoutFormat === 'FREE_V1' && room.placements?.length
        ? fromRoomPlacements(room.placements, cat)
        : null,
    wallpaperId: placement.wallpaperId ?? DEFAULT_WALLPAPER_ID,
    floorId: placement.floorId,
    backgroundId: placement.backgroundId,
    characterId: characterIdFromCode(room.character?.code),
  };
}

/**
 * GET /houses/{id}/preview → 탐색 미리보기 모달 모델 (#328). 카탈로그가 있으면
 * memberRooms를 실제 방 렌더 모델로 함께 변환한다 (#386) — 없으면(상점 미로드)
 * rooms를 비워 화면이 기존 목업으로 폴백하게 둔다.
 */
export function toHousePreviewDetail(
  p: HousePreviewDetailResponse,
  catalogue?: ShopCatalogue,
): HousePreviewDetail {
  return {
    id: String(p.houseId ?? ''),
    name: p.name ?? '',
    description: p.description || undefined,
    coverImageKey: p.coverImageKey ?? undefined,
    members: p.currentMemberCount ?? 0,
    capacity: p.maxMembers ?? undefined,
    level: p.level ?? undefined,
    goals: (p.goals ?? []).map((g) => g.name ?? '').filter(Boolean),
    isMember: p.isMember,
    isFull: p.isFull,
    rooms: catalogue
      ? (p.memberRooms ?? []).map((m: PreviewMemberRoom) => toPreviewRoom(m.room, catalogue))
      : undefined,
  };
}

export function toSearchHouse(h: HouseSummary, index = 0): SearchHouse {
  return {
    id: String(h.houseId ?? ''),
    name: h.name ?? '',
    members: h.currentMemberCount ?? 0,
    capacity: h.maxMembers ?? 0,
    tag: h.goals?.[0]?.name ?? '루틴',
    coverImageKey: h.coverImageKey ?? undefined,
    icon: HOUSE_ICONS[index % HOUSE_ICONS.length],
    bg: HouseBgs[index % HouseBgs.length],
    border: HouseBorders[index % HouseBorders.length],
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
 * FREE_V1 방 조회의 placements → 자유 배치 모델 (#327). 내 방은 userItemMap으로,
 * 남의 방은 assetKey로 카탈로그 아이템을 찾는다(둘 다 시도). z 미지정은 배열
 * 순서를 따른다. 카탈로그에 없는 항목은 건너뛴다.
 */
export function fromRoomPlacements(
  placements: RoomPlacementWire[],
  cat: ShopCatalogue,
  userItemMap?: Map<string, number>,
): PlacedFurniture[] {
  const itemByUserItem = new Map<number, string>();
  if (userItemMap) for (const [itemId, uid] of userItemMap) itemByUserItem.set(uid, itemId);
  const out: PlacedFurniture[] = [];
  for (const [i, p] of placements.entries()) {
    const byUid = p.userItemId != null ? itemByUserItem.get(p.userItemId) : undefined;
    const byAsset = p.assetKey
      ? cat.furniture.find((f) => f.assetKey === p.assetKey)?.id
      : undefined;
    const furnitureId = byUid ?? byAsset;
    if (!furnitureId || !cat.furniture.some((f) => f.id === furnitureId)) continue;
    out.push({
      furnitureId,
      x: p.positionX ?? 0.5,
      y: p.positionY ?? 0.5,
      z: p.zIndex ?? i + 1,
      scale: p.scale,
      rotationDeg: p.rotationDeg,
      flipped: p.flipped,
    });
  }
  return out;
}

/** 자유 배치 모델 → PUT /rooms/me/layout placements (내 인벤토리의 userItemId 필요). */
export function toLayoutPlacements(
  items: PlacedFurniture[],
  userItemMap: Map<string, number>,
): RoomPlacementSave[] {
  const saves: RoomPlacementSave[] = [];
  for (const p of items) {
    const uid = userItemMap.get(p.furnitureId);
    if (uid == null) continue;
    saves.push({
      userItemId: uid,
      // 서버는 소수 좌표를 그대로 저장 — 전송 전 0..1로 클램프만 해준다.
      positionX: Math.min(1, Math.max(0, p.x)),
      positionY: Math.min(1, Math.max(0, p.y)),
      zIndex: p.z,
      scale: p.scale,
      rotationDeg: p.rotationDeg,
      flipped: p.flipped,
    });
  }
  return saves;
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
 * has no local sprite art drop out (the picker model needs an app CharacterId
 * for fallback art and metadata) — null result.
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
    animations: c.animations,
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
