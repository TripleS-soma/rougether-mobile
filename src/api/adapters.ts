/**
 * Mapping between the API's wire types (`./types`) and the app's domain models
 * (`@/constants/routines`, `@/constants/currency`). The app uses string ids
 * (the API's numeric id stringified), 0–6 weekday numbers (0 = Sun), and
 * "HH:MM" times; the API uses numeric ids, MON–SUN day codes, and "HH:mm:ss".
 */
import { isCdnKey } from '@/resources/asset';
import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';
import { type Wallet } from '@/constants/currency';
import { MISSION_TYPE_FALLBACK, MISSION_TYPE_RULES } from '@/constants/missions';
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
import { toIsoDate, relativeTimeLabel } from '@/utils/datetime';
import { type RoomPlacementSave, type RoomPlacementWire } from './rooms';

import type { HouseCover } from '@/components/room/house-cover-picker';
import type {
  Floor,
  House,
  HouseMission,
  MemberRoomPreview,
  RoomCell,
} from '@/components/screens/house-screen';
import type { FriendActivityDay, GuestbookEntry } from '@/components/screens/friend-room-screen';
import { isPictogramName, type PictogramName } from '@/components/ui/pictograms';
import type {
  HousePreview,
  HousePreviewDetail,
  SearchHouse,
} from '@/components/screens/house-search-screen';

import type { CalendarDayItem } from '@/components/screens/my-room-screen';
import type { BugReportEntry } from '@/components/screens/bug-report-screen';
import type { NotificationEntry } from '@/components/screens/notification-list-screen';
import type { NotificationSettings } from '@/components/screens/notification-settings-screen';
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
  CharacterAnimations,
  CharacterPoseResponse,
  CategoryResponse,
  GachaResponse,
  GoalItem,
  HouseCoverImage,
  HouseDetailResponse,
  HouseJoinRequestResponse,
  HouseMemberDayResponse,
  HouseMemberRoutineCompletionListResponse,
  HousePreviewDetailResponse,
  HousePreviewResponse,
  HouseSummary,
  ItemResponse,
  MemberRoomSummary,
  MemberSummary,
  MissionSummary,
  BugReportResponse,
  NotificationItem,
  NotificationSettingResponse,
  RepeatDays,
  RoutineCreateRequest,
  RoutineResponse,
  RoutineUpdateRequest,
  TodayResponse,
  TodoCreateRequest,
  TodoResponse,
  TodoUpdateRequest,
  WalletHistoryResponse,
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
    name: c.name ?? '',
    icon: toCategoryIcon(c.iconKey),
    color: c.colorHex || CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    visibility: visToApp(c.visibility),
    houseId: c.houseId ?? undefined,
    deleted: c.deleted || undefined,
  };
}

export function toCategoryCreate(
  cat: RoutineCategoryMeta,
  sortOrder?: number,
): CategoryCreateRequest {
  return {
    name: cat.name,
    colorHex: cat.color,
    iconKey: cat.icon,
    sortOrder,
    visibility: visToApi(cat.visibility),
    // 집 연동 id (#578) — 없으면 생략(수정 시 null/생략은 기존 유지, 해제는
    // DELETE /categories/{id}/house-link).
    houseId: cat.houseId,
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

/**
 * repeatType + repeatDays request fields from an app-side repeat description.
 * 캘린더 임포트(#952)도 같은 매핑을 써야 한다 — 반복 규칙이 두 군데로 갈리면
 * 한쪽만 고쳐져 임포트한 루틴만 요일이 어긋나는 식으로 틀어진다.
 */
export function toApiRepeat(r: {
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
    linkedMissionId: r.houseMissionId ?? undefined,
  };
}

export function toRoutineCreate(n: NewRoutine): RoutineCreateRequest {
  const { repeatType, repeatDays } = toApiRepeat(n);
  return {
    title: n.title,
    categoryId: toCategoryId(n.category),
    // 사진 인증 생성 경로 제거 (#695) — 신규 루틴은 항상 CHECK. 재도입은 #158.
    authType: 'CHECK',
    repeatType,
    repeatDays,
    scheduledTime: n.alarmEnabled && n.time ? toApiTime(n.time) : undefined,
    startsOn: n.startDate,
    endsOn: n.endDate,
    houseMissionId: n.linkedMissionId,
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
    // 연동 미션 id (#578) — null/생략은 기존 유지라(endsOn 등과 다른 규칙) 값이
    // 있을 때만 실어도 링크가 풀리지 않는다. 해제는 전용 DELETE 엔드포인트.
    houseMissionId: merged.linkedMissionId,
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
// 선물상자 아트는 서버가 준다(`giftBoxAssetKey`, 서버 #276). 아이콘·accent는
// 키가 없거나 CDN 키가 아닐 때의 폴백으로 남는다 — 지금은 14개 머신이 같은
// 상자 한 장을 쓰므로 accent가 머신 구분을 계속 맡는다.
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
    giftBoxKey: g.giftBoxAssetKey,
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

/**
 * 캐릭터 프레임 (#735) — 탭 순환 순서대로의 CDN 키 목록. 앱은 프레임을 **이 한
 * 가지 모양으로만** 다룬다: 포즈가 몇 개든, 어느 엔드포인트에서 왔든.
 *
 * 두 출처가 있다. `/characters`·`/me/characters`는 admin에 등록한 `poses[]`를
 * 주고(개수 자유, `sortOrder` 순), 방 렌더 계열(`RenderCharacter`)은 아직
 * 레거시 3칸(`idle`/`poseCycle`/`wave`)만 준다. poses가 있으면 그쪽이 이기고,
 * 없으면 레거시로 떨어진다 — 서버가 렌더 응답에도 poses를 실어주면 이 함수만
 * 남기고 레거시 갈래를 지우면 된다.
 */
export function toCharacterFrames(
  poses?: CharacterPoseResponse[],
  animations?: CharacterAnimations,
): string[] {
  if (poses?.length) {
    return (
      [...poses]
        // sortOrder가 같으면 id로 — 동률에서 순서가 흔들리지 않게.
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0))
        .map((p) => p.assetKey)
        .filter(isCdnKey)
    );
  }
  return [animations?.idle, animations?.poseCycle, animations?.wave].filter(isCdnKey);
}

/**
 * 마스터 /characters → 캐릭터별 프레임 맵 (#589 → #735) — 온보딩 캐러셀의 활성
 * 카드 재생용. 프레임이 없는 캐릭터는 빠진다(번들 정적 포즈로 폴백).
 */
export function toCharacterFramesMap(
  masters: CharacterItem[],
): Partial<Record<CharacterId, string[]>> {
  const map: Partial<Record<CharacterId, string[]>> = {};
  for (const m of masters) {
    const opt = CHARACTER_OPTIONS.find((o) => o.id === m.code);
    const frames = toCharacterFrames(m.poses, m.animations);
    if (opt && frames.length) map[opt.id] = frames;
  }
  return map;
}

// --- house (집) ------------------------------------------------------------

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
 * 접속 중 판정 창 (#383) — lastAccessedAt은 로그인/refresh 시에만 갱신되는
 * access token TTL(30분) 해상도라, TTL + 여유 10분 안이면 "접속 중"으로 본다.
 */
const ONLINE_WINDOW_MS = 40 * 60 * 1000;

/**
 * MemberSummary.lastAccessedAt(UTC) → 방 타일 접속 표시 (#383). 창 안이면
 * online, 밖이면 상대 시각 라벨("3시간 전"). 값이 없거나(접속 이력 없음)
 * 못 읽으면 둘 다 생략 — 타일은 아무것도 덧붙이지 않는다.
 */
export function toPresence(
  lastAccessedAt: string | undefined,
  nowMs: number,
): { online?: boolean; lastSeenLabel?: string } {
  if (!lastAccessedAt) return {};
  // 스웨거는 UTC를 약속하지만 존 표기가 빠져 오면 로컬로 오독된다 — Z를 보강.
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(lastAccessedAt) ? lastAccessedAt : `${lastAccessedAt}Z`;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return {};
  const diff = nowMs - then;
  if (diff <= ONLINE_WINDOW_MS) return { online: true };
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return { lastSeenLabel: `${minutes}분 전` };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { lastSeenLabel: `${hours}시간 전` };
  const days = Math.floor(hours / 24);
  if (days < 30) return { lastSeenLabel: `${days}일 전` };
  return { lastSeenLabel: '오래 전' };
}

/**
 * Build the house screen model from house detail + members. The grid is
 * sized by the house capacity (not the headcount): rooms fill two per floor
 * from the bottom-left — my room first, then the others in join order — and
 * the yet-unfilled seats render as quiet vacant tiles on the upper floors.
 * Occupied tiles carry the member's presence (#383) derived from
 * `lastAccessedAt` at `nowMs` (injectable for tests).
 */
export function toHouse(
  detail: HouseDetailResponse,
  members: MemberSummary[],
  myUserId?: number,
  myNickname?: string,
  missions?: HouseMission[],
  nowMs: number = Date.now(),
  joinRequests?: HouseJoinRequestResponse[],
): House {
  const active = members.filter((m) => m.status !== 'LEFT');
  // Me first → my room lands on the bottom-left seat.
  const ordered = [
    ...active.filter((m) => m.userId === myUserId),
    ...active.filter((m) => m.userId !== myUserId),
  ];
  const cells: RoomCell[] = ordered.map((m, i) => ({
    // 내 좌석 이름은 **프로필이 우선**이다 (#924). 멤버 API의 nickname은 집을
    // 다시 불러올 때까지 옛 값을 들고 있어서, 프로필을 고쳐도 타일만 예전
    // 이름으로 남았다. 프로필 쪽이 같은 값의 출처이므로 항상 그쪽을 믿는다.
    // (멤버 API에 이름이 아예 없는 경우의 폴백도 겸한다.)
    name:
      (m.userId === myUserId ? myNickname : undefined) || m.nickname || `멤버 ${m.userId ?? i + 1}`,
    color: m.userId === myUserId ? MyRoomTint : RoomTints[i % RoomTints.length],
    isMine: m.userId === myUserId,
    isOwner: m.role === 'OWNER',
    membershipId: m.membershipId,
    userId: m.userId,
    // 동거 봇 (서버 #309) — 구성원 화면이 배지로 구분한다.
    bot: m.bot,
    ...toPresence(m.lastAccessedAt, nowMs),
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
    name: detail.name ?? '',
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
    joinRequests: joinRequests
      // 처리(수락/거절)된 이력이 응답에 섞여도 대기 중만 노출한다 (#526 리뷰).
      ?.filter(
        (request) => request.requestId != null && (request.status ?? 'PENDING') === 'PENDING',
      )
      .map((request) => ({
        requestId: request.requestId!,
        nickname: request.nickname || `멤버 ${request.userId ?? ''}`.trim(),
        requestedAt: request.requestedAt,
      })),
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

/** House-mission card model from the API mission summary. */
/** Server date-time → device-local "YYYY-MM-DD" (mission period display). */
function localDateOf(dateTime: string): string | undefined {
  const d = new Date(dateTime);
  return Number.isNaN(d.getTime()) ? undefined : toIsoDate(d);
}

export function toHouseMission(m: MissionSummary): HouseMission {
  // 아이콘·라벨·단위는 constants/missions의 단일 출처에서 (#887).
  const meta =
    MISSION_TYPE_RULES[m.missionType as keyof typeof MISSION_TYPE_RULES] ?? MISSION_TYPE_FALLBACK;
  const target = m.targetValue ?? 0;
  return {
    id: m.missionId ?? 0,
    title: m.title ?? '',
    desc: meta.label,
    icon: meta.icon,
    /** `25/100`이 %인지 횟수인지 카드에서 드러나게 (#887). */
    unit: meta.unit,
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
    // 부원 개인 코드 (#646/#648) — 입주 대신 신청이 생성되는 코드임을 미리 안내.
    requiresApproval: p.requiresApproval ?? false,
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
    // 방명록은 봇 스케줄러(서버 #310)가 실제로 글을 쓴다 — 누가 썼는지 밝힌다.
    authorBot: g.authorBot,
  };
}

/** Notification → 알림 list row (상대 시간 "N분 전"; 7일 지나면 "M월 D일", #508). */
export function toNotificationEntry(n: NotificationItem): NotificationEntry {
  const d = n.createdAt ? new Date(n.createdAt) : null;
  return {
    id: n.notificationId ?? 0,
    type: n.type,
    title: n.title ?? '알림',
    body: n.body ?? '',
    read: n.isRead === true,
    date: d ? relativeTimeLabel(d) : '',
  };
}

/** Bug report → 내 제보 내역 row (#496) — 미지정 상태는 접수됨으로 본다. */
export function toBugReportEntry(b: BugReportResponse): BugReportEntry {
  const d = b.createdAt ? new Date(b.createdAt) : null;
  return {
    id: b.bugReportId ?? 0,
    title: b.title ?? '',
    status: b.status ?? 'RECEIVED',
    date: d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : '',
  };
}

/**
 * Push 알림 설정 (#495) — 서버가 안 내려준 필드는 서버 기본과 같게 켜짐(true)
 * 으로 본다.
 */
export function toNotificationSettings(res: NotificationSettingResponse): NotificationSettings {
  return { all: res.all ?? true, reminder: res.reminder ?? true, house: res.house ?? true };
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
  if (!room) return { placements: [] };
  // 표면(벽지·바닥·배경)만 슬롯에서 읽는다 — 서버가 거기 저장한다 (서버 #162).
  const surfaces = fromFriendRoomSlots(room.slots ?? [], cat);
  return {
    // 가구는 자유 좌표가 정본 (#925) — layoutFormat 분기 없음.
    placements: fromRoomPlacements(room.placements ?? [], cat),
    wallpaperId: surfaces.wallpaperId ?? DEFAULT_WALLPAPER_ID,
    floorId: surfaces.floorId,
    backgroundId: surfaces.backgroundId,
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
    id: p.houseId ?? 0,
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
      ? (p.memberRooms ?? []).map((m: MemberRoomSummary) => toPreviewRoom(m.room, catalogue))
      : undefined,
    // 단체미션 미리보기 (#532) — 서버(#233)는 완료분까지 최신 생성순으로
    // 보내지만, 미리보기는 유인 목적이라 진행 중(ACTIVE)만 노출한다.
    // 완료 미션은 진행값이 리셋돼(0/3) 고장처럼 읽힌다.
    missions: (p.missions ?? []).map(toHouseMission).filter((m) => m.status === 'ACTIVE'),
  };
}

export function toSearchHouse(h: HouseSummary, index = 0): SearchHouse {
  return {
    id: h.houseId ?? 0,
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
    joinRequestStatus: h.myJoinRequestStatus,
  };
}

// --- room placement (배치 저장) --------------------------------------------------

/** Inventory → itemId(string) → userItemId map (placement saves need userItemId). */
export function toUserItemMap(items: MyItemSummary[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const it of items)
    if (it.itemId != null && it.userItemId != null) map.set(String(it.itemId), it.userItemId);
  return map;
}

/**
 * 내 방 슬롯 → 표면(벽지·바닥·배경) (#925).
 *
 * 가구는 더 이상 슬롯에서 읽지 않는다 — 정본은 placements다. 표면은 서버가
 * 계속 `room_surface_slots`에 저장하고 이 배열로 돌려주므로(서버 #162) 이
 * 경로는 남는다. 소유하지 않은 항목은 건너뛴다.
 */
export function fromRoomSlots(
  slots: RoomSlotResponse[],
  cat: ShopCatalogue,
  userItemMap: Map<string, number>,
): {
  wallpaperId: string | null;
  floorId: string | null;
  backgroundId: string | null;
} {
  const itemByUserItem = new Map<number, string>();
  for (const [itemId, uid] of userItemMap) itemByUserItem.set(uid, itemId);
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
    }
  }
  return { wallpaperId, floorId, backgroundId };
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
  wallpaperId: string | null;
  floorId: string | null;
  backgroundId: string | null;
} {
  const byAsset = (list: { id: string; assetKey?: string }[], key: string) =>
    list.find((i) => i.assetKey && i.assetKey === key)?.id ?? null;
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
    }
  }
  return { wallpaperId, floorId, backgroundId };
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
    frames: toCharacterFrames(c.poses, c.animations),
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
    // 카테고리 그룹핑 (#528, 서버 #237) — day.categories와 매칭용.
    category: r.categoryId != null ? String(r.categoryId) : undefined,
  }));
  const todos = (day.todos ?? []).map((t): Routine => ({
    id: `todo-${t.id ?? ''}`,
    title: t.title ?? '할 일',
    kind: 'todo',
    completed: t.status === 'COMPLETED',
    category: t.categoryId != null ? String(t.categoryId) : undefined,
  }));
  return [...routines, ...todos];
}

/**
 * 멤버 그날 현황의 카테고리 메타 (#528, 서버 #237) — 친구 방 루틴 목록을
 * 본인 화면처럼 카테고리 그룹으로 보여주기 위한 이름·색·아이콘. 비공개
 * 카테고리는 응답에 없으므로 매칭 안 되는 항목은 미분류로 흘러간다.
 */
export function toFriendCategories(day: HouseMemberDayResponse): RoutineCategoryMeta[] {
  return (day.categories ?? []).map((c, i) => ({
    id: String(c.id ?? ''),
    name: c.name ?? '',
    icon: toCategoryIcon(c.iconKey),
    color: c.colorHex || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    // 응답에 실리는 건 공개(HOUSE/PUBLIC) 카테고리뿐 — 표시용 기본값.
    visibility: 'neighbor',
  }));
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
