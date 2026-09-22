/**
 * Routine domain model, ported from the prototype. Mirrors the spec's
 * routine-todo domain (see rougether-spec) — keep field names aligned; the
 * spec repo is the source of truth for the contract.
 */
import type { PictogramName } from '@/components/ui/pictograms';
import { i18n } from '@/i18n';

export type RoutineCategory = string;

/** Mirrors the API's four levels: PUBLIC / HOUSE / FRIENDS / PRIVATE. */
export type CategoryVisibility = 'public' | 'neighbor' | 'partial' | 'private';

/**
 * Human label key for each visibility option (category manager) — screens
 * resolve it with `tr(visibilityLabelKey(v))` so a language change re-renders.
 */
export const visibilityLabelKey = (v: CategoryVisibility) => `routineTodo.visibility.${v}` as const;

/** Call-time label (hooks/utils outside components). */
export const getVisibilityLabel = (v: CategoryVisibility) => i18n.t(visibilityLabelKey(v));

/**
 * Visibility pictogram per option — shared by the category manager sheet and
 * the 나의 방 category headers (#285) so the same mark means the same scope.
 */
export const VISIBILITY_ICONS: Record<CategoryVisibility, PictogramName> = {
  public: 'globe',
  neighbor: 'friends',
  partial: 'handshake',
  private: 'lock',
};

/**
 * 요일 키 — 일요일 시작. 달력 머리글·루틴 요일 칩·조정 추천 카드(#1006)가
 * 같은 순서를 써야 눈이 같은 자리를 찾는다. 라벨은 i18n(#893) —
 * `routineTodo.weekday.<key>`(한 글자)·`routineTodo.weekdayLong.<key>`(요일명).
 * 모듈 로드 시점에 번역하면 언어 변경이 안 먹으므로 호출 시점 getter로 푼다.
 */
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const weekdayLabelKey = (day: number) =>
  `routineTodo.weekday.${WEEKDAY_KEYS[day] ?? 'sun'}` as const;
export const weekdayLongLabelKey = (day: number) =>
  `routineTodo.weekdayLong.${WEEKDAY_KEYS[day] ?? 'sun'}` as const;

/** 요일 한 글자 라벨 7개(일~토) — 호출 시점의 언어로. */
export const getWeekdayLabels = (): string[] =>
  WEEKDAY_KEYS.map((_, day) => i18n.t(weekdayLabelKey(day)));

/** 서버 요일 토큰 — 인덱스가 `WEEKDAY_KEYS`와 맞는다(일요일 0). */
export const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

/** Color palette assigned to newly created categories (cycled by index). */
export const CATEGORY_COLORS = [
  '#E8A87C',
  '#7FA8D4',
  '#C8869C',
  '#7FA87F',
  '#D4A574',
  '#9B8BC4',
  '#E6A0A0',
  '#6FB7B0',
];

export type RoutineCategoryMeta = {
  id: RoutineCategory;
  name: string;
  icon: PictogramName;
  color: string;
  visibility: CategoryVisibility;
  /** 연동된 집의 서버 id (#578) — 미션 연동 카테고리 판정은 이 id로 한다. */
  houseId?: number;
  /** Server-deleted category, kept only to resolve past records' name/color. */
  deleted?: boolean;
};

/**
 * Pseudo-group for routines with no (or an unknown) category when the user has
 * no categories at all — keeps them visible in category-grouped lists. The
 * empty id means quick-adds from this group send no categoryId.
 */
export const UNCATEGORIZED_META: RoutineCategoryMeta = {
  id: '',
  // Getter so the label follows the active language (#893) — read at use time.
  get name() {
    return i18n.t('routineTodo.category.uncategorized');
  },
  icon: 'sparkle',
  color: '#B5A89C',
  visibility: 'public',
};

/**
 * 기본 카테고리 5종 — 화면 기본 prop·갤러리·테스트용 픽스처(실앱 카테고리는 서버).
 * `id`는 기존 기록·테스트가 참조하는 데이터 키라 그대로 두고, 표시명만 언어를 따른다
 * (#1369 — getter라 호출 시점 언어).
 */
const defaultCategory = (
  id: string,
  key: string,
  icon: PictogramName,
  color: string,
  visibility: CategoryVisibility,
): RoutineCategoryMeta => ({
  id,
  get name() {
    return i18n.t(`routineTodo.category.defaults.${key}`);
  },
  icon,
  color,
  visibility,
});

export const ROUTINE_CATEGORIES: RoutineCategoryMeta[] = [
  defaultCategory('일정', 'schedule', 'calendar', '#E8A87C', 'public'),
  defaultCategory('공부', 'study', 'book', '#7FA8D4', 'public'),
  defaultCategory('취미', 'hobby', 'palette', '#C8869C', 'neighbor'),
  defaultCategory('건강', 'health', 'dumbbell', '#7FA87F', 'partial'),
  defaultCategory('기타', 'etc', 'sparkle', '#B5A89C', 'public'),
];

/**
 * Repeat cadence, mirroring the API's repeatType. Omitted on a routine =
 * legacy derivation: with `days` it's weekly, without it's daily.
 */
export type RepeatKind = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export type Routine = {
  id: string;
  title: string;
  /**
   * Legacy single-shot flag — used only by the read-only friend preview.
   * The owner's completion is tracked per date in a completion log (see the app
   * shell's `completions` map), mirroring the spec's `routine_logs`.
   */
  completed?: boolean;
  category?: RoutineCategory;
  repeat?: RepeatKind;
  /** 0 (Sun) … 6 (Sat) — weekly/biweekly (biweekly weeks anchor on startDate). */
  days?: number[];
  /** Day of month 1–31 — monthly, or yearly together with `month`. */
  dayOfMonth?: number;
  /** Month 1–12 — yearly. */
  month?: number;
  startDate?: string;
  endDate?: string;
  /** Todo due date, "YYYY-MM-DD" (kind === 'todo'). */
  dueDate?: string;
  alarmEnabled?: boolean;
  /** "HH:MM" 24h */
  time?: string;
  /**
   * 서버 authType='PHOTO' 왕복 보존용 (#695 — UI는 제거됨). 수정 PUT이 전체
   * 교체 계약이라 기존 사진 인증 루틴의 값이 바뀌지 않게만 쓰인다. 재도입은 #158.
   */
  photoVerify?: boolean;
  kind?: 'routine' | 'todo';
  /** 연동된 공동미션의 서버 id (#578) — 미션 연동 판정은 이름 대신 이 id로. */
  linkedMissionId?: number;
  /**
   * 건너뛴 발생분 날짜들 (#189, "YYYY-MM-DD") — 그날은 예정에서 빠진다. 서버 SKIPPED
   * 로그의 로컬 사본이며 오늘·미래만 담긴다(`routine-skips-store`).
   */
  skippedDates?: string[];
};

/**
 * 루틴 몫 옮기기의 서버 건너뜀(SKIPPED) 사용 여부 (#189 · #1334). 서버 #390 배포 전엔 false였다 —
 * 옛 서버는 `status`를 무시하고 그 POST를 **완료**로 기록했다. 2026-09-22 운영 api-docs에
 * `RoutineLogCreateRequest.status`(SKIPPED 포함)가 노출된 것을 확인하고 true로 올렸다.
 * 플래그는 롤백 스위치로 남긴다.
 */
export const ROUTINE_OCCURRENCE_SKIP_ENABLED = true;

/** Payload for creating/editing a routine (from the Add/Edit routine screen). */
export type NewRoutine = {
  title: string;
  category: RoutineCategory;
  /** Omitted = legacy derivation (days ? weekly : daily). */
  repeat?: RepeatKind;
  days: number[];
  /** Monthly (or yearly, with `month`) repeat day 1–31. */
  dayOfMonth?: number;
  /** Yearly repeat month 1–12. */
  month?: number;
  startDate: string;
  endDate?: string;
  alarmEnabled: boolean;
  time: string;
  /** 생성 시 연동할 공동미션 id (#578) — 미션 '+ 내 루틴에' 경로가 넣는다. */
  linkedMissionId?: number;
};

/** Sample data for previews and tests (mirrors the prototype defaults). */
export const SAMPLE_ROUTINES: Routine[] = [
  {
    id: '1',
    title: '아침 7시 기상',
    completed: true,
    category: '일정',
    alarmEnabled: true,
    time: '07:00',
  },
  {
    id: '2',
    title: '독서 30분',
    completed: true,
    category: '취미',
    alarmEnabled: true,
    time: '21:30',
  },
  {
    id: '3',
    title: '물 2L 마시기',
    completed: true,
    category: '건강',
    alarmEnabled: false,
    time: '12:00',
  },
  {
    id: '4',
    title: '영어 공부',
    completed: false,
    category: '공부',
    alarmEnabled: true,
    time: '20:00',
  },
  {
    id: '5',
    title: '하루 회고',
    completed: false,
    category: '일정',
    alarmEnabled: true,
    time: '23:00',
  },
];
