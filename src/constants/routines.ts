/**
 * Routine domain model, ported from the prototype. Mirrors the spec's
 * routine-todo domain (see rougether-spec) — keep field names aligned; the
 * spec repo is the source of truth for the contract.
 */
import type { PictogramName } from '@/components/ui/pictograms';

export type RoutineCategory = string;

/** Mirrors the API's four levels: PUBLIC / HOUSE / FRIENDS / PRIVATE. */
export type CategoryVisibility = 'public' | 'neighbor' | 'partial' | 'private';

/** Human labels for each visibility option (category manager). */
export const VISIBILITY_LABELS: Record<CategoryVisibility, string> = {
  public: '전체 공개',
  neighbor: '이웃 공개',
  partial: '일부 공개',
  private: '비공개',
};

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
  name: '미분류',
  icon: 'sparkle',
  color: '#B5A89C',
  visibility: 'public',
};

export const ROUTINE_CATEGORIES: RoutineCategoryMeta[] = [
  { id: '일정', name: '일정', icon: 'calendar', color: '#E8A87C', visibility: 'public' },
  { id: '공부', name: '공부', icon: 'book', color: '#7FA8D4', visibility: 'public' },
  { id: '취미', name: '취미', icon: 'palette', color: '#C8869C', visibility: 'neighbor' },
  { id: '건강', name: '건강', icon: 'dumbbell', color: '#7FA87F', visibility: 'partial' },
  { id: '기타', name: '기타', icon: 'sparkle', color: '#B5A89C', visibility: 'public' },
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
};

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
