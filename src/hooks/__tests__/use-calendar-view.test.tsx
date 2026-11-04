import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCalendarView } from '@/hooks/use-calendar-view';
import { useCalendarData } from '@/hooks/use-calendar-data';
import { jsonRes } from '@/test-utils/fetch';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.useRealTimers();
});
const NO_ROUTINES: [] = [];
it('기존 완료/취소 뮤테이션과 같은 월 캐시를 관찰해 완료수를 갱신한다', async () => {
  let completed = false;
  let total = 1;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/todos/1') && init?.method === 'POST') completed = true;
    if (url.includes('/todos/1') && init?.method === 'DELETE') completed = false;
    if (url.includes('/calendar/month'))
      return jsonRes({
        days: [
          {
            date: '2026-09-08',
            routineCount: 0,
            routineCompletedCount: 0,
            todoCount: total,
            todoCompletedCount: completed ? total : 0,
          },
        ],
      });
    if (url.includes('/calendar?'))
      return jsonRes({
        date: '2026-09-08',
        categories: [
          {
            todos: total
              ? [{ id: 1, title: '할 일', status: completed ? 'COMPLETED' : 'PENDING' }]
              : [],
          },
        ],
      });
    return jsonRes({});
  }) as unknown as typeof fetch;
  const qc = createTestQueryClient();
  const reload = jest.fn(async () => {});
  const { result, unmount } = await renderHook(
    () => ({
      view: useCalendarView(reload),
      data: useCalendarData({ routines: NO_ROUTINES, refreshWallet: reload }),
    }),
    { wrapper: queryWrapper(qc) },
  );
  await act(async () => {
    result.current.view.setMonth('2026-09');
    result.current.view.setSelectedDate('2026-09-08');
    await result.current.data.loadCalendarDay('2026-09-08');
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCompletedCount).toBe(0));
  await act(async () => {
    await result.current.data.toggleCalendarItem(
      result.current.data.calendarDays['2026-09-08'][0],
      '2026-09-08',
    );
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCompletedCount).toBe(1));
  await act(async () => {
    await result.current.data.toggleCalendarItem(
      result.current.data.calendarDays['2026-09-08'][0],
      '2026-09-08',
    );
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCompletedCount).toBe(0));
  // 삭제/재추가 뒤 기존 훅의 무효화 경로가 새 월 observer에도 도달한다.
  total = 0;
  await act(async () => {
    result.current.data.invalidateCalendar();
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCount).toBe(0));
  total = 1;
  await act(async () => {
    result.current.data.invalidateCalendar();
  });
  await waitFor(() => expect(result.current.view.monthDays?.[0].todoCount).toBe(1));
  await unmount();
  qc.clear();
});
it('KST 자정에는 오늘 선택을 다음 날로 옮기고 현재 월 캐시와 오늘을 갱신한다', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-30T14:59:59.000Z'));
  global.fetch = jest.fn(async () =>
    jsonRes({ days: [], categories: [] }),
  ) as unknown as typeof fetch;
  const qc = createTestQueryClient();
  const reload = jest.fn(async () => {});
  const { result } = await renderHook(() => useCalendarView(reload), { wrapper: queryWrapper(qc) });
  expect(result.current.today).toBe('2026-09-30');
  await act(async () => {
    jest.advanceTimersByTime(1100);
  });
  expect(result.current.today).toBe('2026-10-01');
  expect(result.current.selectedDate).toBe('2026-10-01');
  expect(reload).toHaveBeenCalledTimes(1);
});
it('KST 자정에도 사용자가 고른 과거 날짜는 유지한다', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-09T14:59:59.000Z'));
  const { result } = await renderHook(() => useCalendarView(async () => {}), {
    wrapper: queryWrapper(),
  });
  await act(async () => {
    result.current.setSelectedDate('2026-08-15');
  });
  await act(async () => {
    jest.advanceTimersByTime(1100);
  });
  expect(result.current.selectedDate).toBe('2026-08-15');
  expect(result.current.today).toBe('2026-09-10');
});

it('prefetchWeek는 그 주 7일 중 오늘을 뺀 날을 받고, 같은 주를 다시 부르면 요청하지 않는다 (2026-11-04)', async () => {
  const requested: string[] = [];
  global.fetch = jest.fn(async (url: string) => {
    const m = /\/calendar\?date=(\d{4}-\d{2}-\d{2})/.exec(url);
    if (m) requested.push(m[1]);
    return jsonRes({ date: m?.[1] ?? '', categories: [] });
  }) as unknown as typeof fetch;
  const qc = createTestQueryClient();
  const { result, unmount } = await renderHook(() => useCalendarView(async () => {}), {
    wrapper: queryWrapper(qc),
  });
  const today = result.current.today;
  // 오늘이 든 주를 미리 받는다 — 오늘은 방 데이터로 그리므로 빠진다.
  await act(async () => result.current.prefetchWeek(today));
  await waitFor(() => expect(requested).toHaveLength(6));
  expect(requested).not.toContain(today);
  // 같은 주의 다른 날로 다시 불러도 이미 받은 날은 건너뛴다.
  await act(async () => result.current.prefetchWeek(requested[0]));
  await act(async () => {});
  expect(requested).toHaveLength(6);
  await unmount();
  qc.clear();
});
