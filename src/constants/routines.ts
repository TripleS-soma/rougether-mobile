/**
 * Routine domain model, ported from the prototype. Mirrors the spec's
 * routine-todo domain (see rougether-spec) — keep field names aligned; the
 * spec repo is the source of truth for the contract.
 */
export type RoutineCategory = string;

export type CategoryVisibility = 'public' | 'neighbor' | 'partial';

export type RoutineCategoryMeta = {
  id: RoutineCategory;
  label: string;
  emoji: string;
  color: string;
  visibility: CategoryVisibility;
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
  completed: boolean;
  emoji?: string;
  category?: RoutineCategory;
  /** 0 (Sun) … 6 (Sat) */
  days?: number[];
  startDate?: string;
  endDate?: string;
  alarmEnabled?: boolean;
  /** "HH:MM" 24h */
  time?: string;
  photoVerify?: boolean;
  kind?: 'routine' | 'todo';
};

/** Payload for creating/editing a routine (from the Add/Edit routine screen). */
export type NewRoutine = {
  title: string;
  emoji: string;
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
    emoji: '⏰',
    category: '일정',
    alarmEnabled: true,
    time: '07:00',
  },
  {
    id: '2',
    title: '독서 30분',
    completed: true,
    emoji: '📚',
    category: '취미',
    alarmEnabled: true,
    time: '21:30',
    photoVerify: true,
  },
  {
    id: '3',
    title: '물 2L 마시기',
    completed: true,
    emoji: '💧',
    category: '건강',
    alarmEnabled: false,
    time: '12:00',
  },
  {
    id: '4',
    title: '영어 공부',
    completed: false,
    emoji: '✏️',
    category: '공부',
    alarmEnabled: true,
    time: '20:00',
    photoVerify: true,
  },
  {
    id: '5',
    title: '하루 회고',
    completed: false,
    emoji: '📝',
    category: '일정',
    alarmEnabled: true,
    time: '23:00',
  },
];
