import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMyRoomData } from '@/hooks/use-my-room-data';
import { useCalendarView } from '@/hooks/use-calendar-view';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';
import { jsonRes } from '@/test-utils/fetch';
import { calendarToday } from '@/utils/calendar-progress';
import { shiftIso } from '@/utils/datetime';
import type { TodoResponse, RoutineResponse } from '@/api/types';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});
async function setup(date: string) {
  let todos: TodoResponse[] = [];
  const routines: RoutineResponse[] = [];
  let serial = 1;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'POST' && url.endsWith('/todos')) {
      const item = { ...JSON.parse(init?.body as string), id: serial++, status: 'PENDING' };
      todos.push(item);
      return jsonRes(item);
    }
    if (method === 'DELETE' && url.includes('/todos/')) {
      todos = [];
      return jsonRes({});
    }
    if (method === 'POST' && url.endsWith('/routines')) {
      const item = { ...JSON.parse(init?.body as string), id: serial++ };
      routines.push(item);
      return jsonRes(item);
    }
    if (method === 'DELETE' && url.includes('/categories/1?mode=PURGE')) {
      todos = [];
      return jsonRes({});
    }
    if (url.includes('/calendar/month'))
      return jsonRes({
        days: [
          {
            date,
            routineCount: routines.length,
            routineCompletedCount: 0,
            todoCount: todos.length,
            todoCompletedCount: 0,
          },
        ],
      });
    if (url.includes('/calendar?'))
      return jsonRes({ date, categories: [{ categoryId: 1, todos, routines }] });
    if (url.includes('/categories')) return jsonRes({ items: [{ id: 1, name: '생활' }] });
    if (url.endsWith('/todos')) return jsonRes({ items: todos });
    if (url.endsWith('/routines')) return jsonRes({ items: routines });
    if (url.endsWith('/today')) return jsonRes({ categories: [], summary: {}, streak: {} });
    if (url.endsWith('/me')) return jsonRes({ userId: 1, nickname: '테스터' });
    return jsonRes({ items: [] });
  }) as unknown as typeof fetch;
  const qc = createTestQueryClient();
  const hook = await renderHook(
    () => {
      const data = useMyRoomData();
      return { data, view: useCalendarView(data.reload) };
    },
    { wrapper: queryWrapper(qc) },
  );
  await waitFor(() => expect(hook.result.current.data.loading).toBe(false));
  await act(async () => {
    hook.result.current.view.setMonth(date.slice(0, 7));
    hook.result.current.view.setSelectedDate(date);
  });
  await waitFor(() => expect(hook.result.current.view.monthDays?.[0].todoCount).toBe(0));
  return {
    ...hook,
    finish: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}
it.each([-1, 0, 1])('오늘 기준 %i일 quick add·삭제·재추가가 월 숫자에 반영된다', async (offset) => {
  const date = shiftIso(calendarToday(), offset);
  const { result, finish } = await setup(date);
  await act(async () => {
    await result.current.data.quickAddTodo('1', '새 할 일', date);
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCount).toBe(1));
  await act(async () => {
    await result.current.data.deleteRoutine(result.current.data.routines[0].id);
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCount).toBe(0));
  await act(async () => {
    await result.current.data.quickAddTodo('1', '다시 추가', date);
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCount).toBe(1));
  await finish();
});
it('선택일에서 루틴을 만들면 월 routineCount를 다시 조회한다', async () => {
  const date = calendarToday();
  const { result, finish } = await setup(date);
  await act(async () => {
    await result.current.data.addRoutine({
      title: '독서',
      category: '1',
      repeat: 'daily',
      days: [],
      startDate: date,
      alarmEnabled: false,
      time: '09:00',
    });
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].routineCount).toBe(1));
  await finish();
});
it('카테고리 PURGE 뒤 삭제된 할 일은 월 집계와 목록에서 사라진다', async () => {
  const date = calendarToday();
  const { result, finish } = await setup(date);
  await act(async () => {
    await result.current.data.quickAddTodo('1', '삭제 대상', date);
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCount).toBe(1));
  await act(async () => {
    await result.current.data.deleteRoutineCategory('1', 'PURGE');
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCount).toBe(0));
  expect(result.current.data.routines).toHaveLength(0);
  await finish();
});
