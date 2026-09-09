import { useState } from 'react';
import { MyRoomScreen, type CalendarDayItem } from '@/components/screens/my-room-screen';
import type { CalendarDayCount } from '@/api/types';

const TODAY = '2026-09-09';
const DAYS: CalendarDayCount[] = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-09-${String(i + 1).padStart(2, '0')}`,
  routineCount: i === 5 ? 0 : 3,
  todoCount: i === 5 ? 0 : 2,
  routineCompletedCount: i >= 9 || i === 5 ? 0 : i % 4,
  todoCompletedCount: i >= 9 || i === 5 ? 0 : i % 3,
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
  const [items, setItems] = useState(ITEMS);
  const completedRoutines = items.filter((i) => i.kind === 'routine' && i.completed).length;
  const completedTodos = items.filter((i) => i.kind === 'todo' && i.completed).length;
  const month = DAYS.map((d) =>
    d.date === '2026-09-08'
      ? { ...d, routineCompletedCount: completedRoutines, todoCompletedCount: completedTodos }
      : d,
  );
  return (
    <MyRoomScreen
      view="calendar"
      today={TODAY}
      selectedDate={date}
      onSelectedDateChange={setDate}
      routines={[]}
      categories={[]}
      calendarMonthDays={month}
      calendarDays={{
        [date]: date.endsWith('06')
          ? []
          : date > TODAY
            ? ITEMS.map((i) => ({ ...i, completed: false }))
            : items,
      }}
      onSelectDate={() => {}}
      onToggleCalendarItem={(item) =>
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, completed: !i.completed } : i)),
        )
      }
    />
  );
}
