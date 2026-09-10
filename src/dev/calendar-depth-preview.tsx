import { useState } from 'react';
import { MyRoomScreen, type CalendarDayItem } from '@/components/screens/my-room-screen';
import type { CalendarDayCount } from '@/api/types';

const TODAY = '2026-09-09';
const TODO_DAYS = new Set([2, 5, 8, 10, 14, 18, 23, 26, 30]);
const DAYS: CalendarDayCount[] = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-09-${String(i + 1).padStart(2, '0')}`,
  routineCount: i === 5 ? 0 : 3,
  todoCount: TODO_DAYS.has(i + 1) ? 2 : 0,
  routineCompletedCount: i >= 9 || i === 5 ? 0 : i % 4,
  todoCompletedCount: i >= 9 || !TODO_DAYS.has(i + 1) ? 0 : i % 3,
}));
const ITEMS: CalendarDayItem[] = [
  { id: 'r-1', kind: 'routine', title: '아침 스트레칭 10분', time: '07:30', completed: true },
  { id: 'r-2', kind: 'routine', title: '책 20쪽 읽기', time: '21:00', completed: false },
  { id: 'r-3', kind: 'routine', title: '산책하며 하루 정리', completed: false },
  { id: 't-1', kind: 'todo', title: '멘토링 피드백 정리', completed: true },
  { id: 't-2', kind: 'todo', title: '프로젝트 회고 작성', completed: false },
];
export function CalendarDepthPreview() {
  const [date, setDate] = useState('2026-09-08');
  const [itemsByDate, setItemsByDate] = useState<Record<string, CalendarDayItem[]>>(() =>
    Object.fromEntries(
      DAYS.map((day) => [
        day.date!,
        day.date === '2026-09-08'
          ? ITEMS
          : ITEMS.filter((item) =>
              item.kind === 'routine' ? day.routineCount : day.todoCount,
            ).map((item, index, list) => ({
              ...item,
              completed:
                list.slice(0, index).filter((previous) => previous.kind === item.kind).length <
                (item.kind === 'routine'
                  ? (day.routineCompletedCount ?? 0)
                  : (day.todoCompletedCount ?? 0)),
            })),
      ]),
    ),
  );
  const month = DAYS.map((day) => ({
    ...day,
    todoCount: (itemsByDate[day.date!] ?? []).filter((item) => item.kind === 'todo').length,
    routineCompletedCount: (itemsByDate[day.date!] ?? []).filter(
      (item) => item.kind === 'routine' && item.completed,
    ).length,
    todoCompletedCount: (itemsByDate[day.date!] ?? []).filter(
      (item) => item.kind === 'todo' && item.completed,
    ).length,
  }));
  return (
    <MyRoomScreen
      view="calendar"
      today={TODAY}
      selectedDate={date}
      onSelectedDateChange={setDate}
      routines={[]}
      categories={[]}
      calendarMonthDays={month}
      markedTodoDates={
        new Set(month.filter((day) => (day.todoCount ?? 0) > 0).map((day) => day.date!))
      }
      calendarDays={itemsByDate}
      onSelectDate={() => {}}
      onQuickAddRoutine={(category, title, dueDate) => {
        setItemsByDate((previous) => ({
          ...previous,
          [dueDate]: [
            ...(previous[dueDate] ?? []),
            {
              id: `t-${Date.now()}`,
              kind: 'todo',
              title,
              category: category || undefined,
              completed: false,
            },
          ],
        }));
        return true;
      }}
      onToggleCalendarItem={(item) =>
        setItemsByDate((prev) => ({
          ...prev,
          [date]: (prev[date] ?? []).map((i) =>
            i.id === item.id ? { ...i, completed: !i.completed } : i,
          ),
        }))
      }
    />
  );
}
