/**
 * Mapping between the API's wire types (`@/api/types`) and the app's domain
 * models. The app uses string ids (the API's numeric id stringified), 0–6
 * weekday numbers (0 = Sun), and "HH:MM" times; the API uses numeric ids,
 * MON–SUN day codes, and "HH:mm:ss".
 *
 * Routine / todo / category / completion adapters. Split by domain (member / routine-todo / room / house / shop-gacha /
 * notification); `@/api/adapters` re-exports everything, so consumers keep
 * importing from the barrel.
 */
import {
  CATEGORY_COLORS,
  DAY_CODES,
  type CategoryVisibility,
  type NewRoutine,
  type RepeatKind,
  type Routine,
  type RoutineCategoryMeta,
} from '@/constants/routines';
import type { CalendarDayItem } from '@/components/screens/my-room-screen';
import { toCategoryIcon } from '@/api/adapters/shared';
import type {
  CalendarDayResponse,
  CategoryCreateRequest,
  CategoryResponse,
  RepeatDays,
  RoutineCreateRequest,
  RoutineResponse,
  RoutineUpdateRequest,
  TodayResponse,
  TodoCreateRequest,
  TodoResponse,
  TodoUpdateRequest,
} from '@/api/types';

// Weekday code by app day number (0 = Sunday … 6 = Saturday).
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
// (LEGACY_EMOJI_ICONS / toCategoryIcon live in ./shared — the house adapters
// resolve member-day category icons through the same table.)
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
