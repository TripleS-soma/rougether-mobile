import type {
  CalendarMonthResponse,
  CategoryResponse,
  RoutineResponse,
  TodayResponse,
  TodoResponse,
} from '../../src/api/types';
import { type List, TODAY } from './common';

const categories = [
  { id: 11, name: '운동', colorHex: '#E8A87C', iconKey: 'fitness', sortOrder: 1 },
  { id: 12, name: '공부', colorHex: '#85C1A3', iconKey: 'book', sortOrder: 2 },
  { id: 13, name: '생활', colorHex: '#9AB3E0', iconKey: 'home', sortOrder: 3 },
].map((c) => ({ ...c, visibility: 'PRIVATE' as const, deleted: false, houseId: null }));

const routine = (id: number, title: string, categoryId: number, scheduledTime: string) =>
  ({
    id,
    title,
    categoryId,
    authType: 'CHECK',
    status: 'ACTIVE',
    repeatType: 'DAILY',
    scheduledTime,
    startsOn: '2026-11-01',
    houseMissionId: null,
  }) satisfies RoutineResponse;

const routines = [
  routine(21, '아침 스트레칭', 11, '07:30'),
  routine(22, '저녁 산책', 11, '20:00'),
  routine(23, '영어 단어 20개', 12, '09:00'),
  routine(24, '물 2L 마시기', 13, '12:00'),
];

const todos = [
  { id: 31, title: '도서관 책 반납', categoryId: 12, dueDate: TODAY, status: 'PENDING' },
  { id: 32, title: '장보기', categoryId: 13, dueDate: TODAY, status: 'PENDING' },
] satisfies TodoResponse[];

const today = {
  date: TODAY,
  categories: categories.map((c) => ({
    categoryId: c.id,
    routines: routines
      .filter((r) => r.categoryId === c.id)
      .map((r) => ({
        id: r.id,
        title: r.title,
        scheduledTime: r.scheduledTime,
        authType: r.authType,
        completed: r.id === 21,
      })),
    todos: todos
      .filter((t) => t.categoryId === c.id)
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, status: t.status })),
  })),
  summary: { completedCount: 1, remainingCount: 5, progressRate: 17 },
  streak: { currentCount: 3, longestCount: 5, lastSuccessDate: '2026-11-18' },
} satisfies TodayResponse;

/** 11월 1일부터 오늘까지 — 날짜별 개수만. */
const calendarMonth = {
  yearMonth: '2026-11',
  days: Array.from({ length: 19 }, (_, i) => ({
    date: `2026-11-${String(i + 1).padStart(2, '0')}`,
    routineCount: 4,
    todoCount: i === 18 ? 2 : 0,
    routineCompletedCount: i === 18 ? 1 : 3,
    todoCompletedCount: 0,
  })),
} satisfies CalendarMonthResponse;

/** 루틴·할 일 — 카테고리 3개, 루틴 4개 + 할 일 2개. */
export const ROUTINE_TODO_FIXTURES = {
  'GET /categories': { items: categories } satisfies List<CategoryResponse>,
  'GET /routines': { items: routines } satisfies List<RoutineResponse>,
  'GET /todos': { items: todos } satisfies List<TodoResponse>,
  'GET /today': today,
  'GET /calendar/month': calendarMonth,
};
