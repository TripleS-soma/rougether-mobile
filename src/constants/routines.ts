/**
 * Routine domain model, ported from the prototype. Mirrors the spec's
 * routine-todo domain (see rougether-spec) — keep field names aligned; the
 * spec repo is the source of truth for the contract.
 */
export type RoutineCategory = string;

export type CategoryVisibility = 'public' | 'neighbor' | 'partial';

/** Human labels for each visibility option (category manager). */
export const VISIBILITY_LABELS: Record<CategoryVisibility, string> = {
  public: '전체 공개',
  neighbor: '이웃 공개',
  partial: '일부 공개',
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
  label: string;
  emoji: string;
  color: string;
  visibility: CategoryVisibility;
};

/**
 * Pseudo-group for routines with no (or an unknown) category when the user has
 * no categories at all — keeps them visible in category-grouped lists. The
 * empty id means quick-adds from this group send no categoryId.
 */
export const UNCATEGORIZED_META: RoutineCategoryMeta = {
  id: '',
  label: '기타',
  emoji: '✨',
  color: '#B5A89C',
  visibility: 'public',
};

export const ROUTINE_CATEGORIES: RoutineCategoryMeta[] = [
  { id: '일정', label: '일정', emoji: '🗓️', color: '#E8A87C', visibility: 'public' },
  { id: '공부', label: '공부', emoji: '📚', color: '#7FA8D4', visibility: 'public' },
  { id: '취미', label: '취미', emoji: '🎨', color: '#C8869C', visibility: 'neighbor' },
  { id: '건강', label: '건강', emoji: '💪', color: '#7FA87F', visibility: 'partial' },
  { id: '기타', label: '기타', emoji: '✨', color: '#B5A89C', visibility: 'public' },
];

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
  /** 0 (Sun) … 6 (Sat) */
  days?: number[];
  startDate?: string;
  endDate?: string;
  /** Todo due date, "YYYY-MM-DD" (kind === 'todo'). */
  dueDate?: string;
  alarmEnabled?: boolean;
  /** "HH:MM" 24h */
  time?: string;
  photoVerify?: boolean;
  kind?: 'routine' | 'todo';
};

/** Payload for creating/editing a routine (from the Add/Edit routine screen). */
export type NewRoutine = {
  title: string;
  category: RoutineCategory;
  days: number[];
  startDate: string;
  endDate?: string;
  alarmEnabled: boolean;
  time: string;
  photoVerify: boolean;
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
    photoVerify: true,
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
    photoVerify: true,
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
