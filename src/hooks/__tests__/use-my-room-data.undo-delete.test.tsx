/**
 * 실행 취소가 되는 삭제 (#1676) — 나의 방·달력 목록의 삭제는 행을 바로 빼고 5초 뒤 서버에
 * 지운다. 되돌리면 서버 요청 없이 행만 돌아오고, 백그라운드로 가면 남은 삭제를 바로 확정한다.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { UNDO_COMMIT_GRACE_MS, UNDO_DELETE_MS, useMyRoomData } from '@/hooks/use-my-room-data';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';
import { jsonRes } from '@/test-utils/fetch';
import { calendarToday } from '@/utils/calendar-progress';

const mockToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({ useToast: () => ({ show: mockToast }) }));

const realFetch = global.fetch;
let appStateListener: ((s: AppStateStatus) => void) | null = null;
beforeEach(() => {
  mockToast.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
    if (type === 'change') appStateListener = listener as (s: AppStateStatus) => void;
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  global.fetch = realFetch;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function setup({
  failDelete = false,
  count = 1,
  holdDelete,
}: { failDelete?: boolean; count?: number; holdDelete?: Promise<void> } = {}) {
  const deletes: string[] = [];
  const todos = Array.from({ length: count }, (_, i) => ({
    id: 7 + i,
    title: `할 일 ${i + 1}`,
    categoryId: 1,
    status: 'PENDING',
    dueDate: calendarToday(),
  }));
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'DELETE') {
      // 요청을 붙잡아 '서버에 아직 반영 안 됨'을 흉내 낸다.
      if (holdDelete) await holdDelete;
      deletes.push(url);
      if (failDelete) return jsonRes({ code: 'INTERNAL' }, 500);
      return jsonRes({});
    }
    if (url.includes('/categories')) return jsonRes({ items: [{ id: 1, name: '생활' }] });
    // 달력 날짜 목록 — 서버에 남은 투두를 그대로 돌려준다(삭제 반영 전엔 옛 값).
    if (url.includes('/calendar?'))
      return jsonRes({
        categories: [
          {
            categoryId: 1,
            todos: todos
              .filter((t) => failDelete || !deletes.some((u) => u.endsWith(`/${t.id}`)))
              .map((t) => ({ id: t.id, title: t.title, status: t.status })),
          },
        ],
        summary: {},
      });
    // 실패한 삭제는 서버에 그대로 남는다.
    if (url.endsWith('/todos'))
      return jsonRes({
        items: failDelete
          ? todos
          : todos.filter((t) => !deletes.some((u) => u.endsWith(`/${t.id}`))),
      });
    if (url.endsWith('/routines')) return jsonRes({ items: [] });
    if (url.endsWith('/today')) return jsonRes({ categories: [], summary: {}, streak: {} });
    if (url.endsWith('/me')) return jsonRes({ userId: 1, nickname: '테스터' });
    return jsonRes({ items: [] });
  }) as unknown as typeof fetch;
  const hook = await renderHook(() => useMyRoomData(), {
    wrapper: queryWrapper(createTestQueryClient()),
  });
  await waitFor(() => expect(hook.result.current.routines).toHaveLength(count));
  return { ...hook, deletes, id: hook.result.current.routines[0].id };
}

it('지우면 행은 바로 빠지고 "실행 취소" 토스트가 뜬다 — 서버는 아직 그대로', async () => {
  const { result, deletes, id } = await setup();
  await act(async () => result.current.deleteRoutineUndoable(id));
  expect(result.current.routines).toHaveLength(0);
  expect(deletes).toHaveLength(0);
  const [message, type, options] = mockToast.mock.calls.at(-1)!;
  expect(message).toBe('할 일을 삭제했어요');
  expect(type).toBe('info');
  expect(options.action.label).toBe('실행 취소');
  expect(options.durationMs).toBe(UNDO_DELETE_MS);
});

it('실행 취소하면 서버 요청 없이 같은 행이 돌아온다', async () => {
  const { result, deletes, id } = await setup();
  await act(async () => result.current.deleteRoutineUndoable(id));
  const undo = mockToast.mock.calls.at(-1)![2].action.onPress as () => void;
  await act(async () => undo());
  expect(result.current.routines.map((r) => r.id)).toEqual([id]);
  jest.useFakeTimers();
  await act(async () => jest.advanceTimersByTime(UNDO_DELETE_MS + UNDO_COMMIT_GRACE_MS + 100));
  expect(deletes).toHaveLength(0);
});

it('되돌리지 않으면 시간이 지난 뒤 서버에 지운다', async () => {
  const { result, deletes, id } = await setup();
  jest.useFakeTimers();
  await act(async () => result.current.deleteRoutineUndoable(id));
  expect(deletes).toHaveLength(0);
  // 토스트가 사라지는 순간엔 아직 — 토스트의 onDismiss가 먼저 확정하고, 타이머는 안전망이다.
  await act(async () => jest.advanceTimersByTime(UNDO_DELETE_MS));
  expect(deletes).toHaveLength(0);
  await act(async () => jest.advanceTimersByTime(UNDO_COMMIT_GRACE_MS));
  expect(deletes).toEqual([expect.stringContaining('/todos/7')]);
});

it('inactive(알림센터·시스템 창)로는 확정하지 않는다 — 토스트가 남아 있다 (#1677 리뷰)', async () => {
  const { result, deletes, id } = await setup();
  await act(async () => result.current.deleteRoutineUndoable(id));
  await act(async () => appStateListener?.('inactive'));
  expect(deletes).toHaveLength(0);
  const undo = mockToast.mock.calls.at(-1)![2].action.onPress as () => void;
  await act(async () => undo());
  expect(result.current.routines.map((r) => r.id)).toEqual([id]);
});

it('앱이 백그라운드로 가면 남은 삭제를 바로 확정한다 — 되돌릴 사람이 없다', async () => {
  const { result, deletes, id } = await setup();
  await act(async () => result.current.deleteRoutineUndoable(id));
  await act(async () => appStateListener?.('background'));
  await waitFor(() => expect(deletes).toHaveLength(1));
  // 확정 뒤의 실행 취소는 아무 일도 하지 않는다.
  const undo = mockToast.mock.calls.at(-1)![2].action.onPress as () => void;
  await act(async () => undo());
  expect(result.current.routines).toHaveLength(0);
});

it('기다리는 동안 다시 불러와도 지운 행이 되살아나지 않는다 (#1677 리뷰)', async () => {
  const { result, deletes, id } = await setup();
  await act(async () => result.current.deleteRoutineUndoable(id));
  // 서버엔 아직 있다 — 포커스 재조회 등.
  await act(async () => {
    await result.current.reload();
  });
  expect(deletes).toHaveLength(0);
  expect(result.current.routines).toHaveLength(0);
});

it('서버 삭제가 실패하면 행을 돌려놓고 알린다 (#1677 리뷰)', async () => {
  const { result, id } = await setup({ failDelete: true });
  jest.useFakeTimers();
  await act(async () => result.current.deleteRoutineUndoable(id));
  await act(async () => jest.advanceTimersByTime(UNDO_DELETE_MS + UNDO_COMMIT_GRACE_MS));
  jest.useRealTimers();
  await waitFor(() => expect(result.current.routines.map((r) => r.id)).toEqual([id]));
  expect(mockToast).toHaveBeenCalledWith('삭제에 실패했어요', 'error');
});

it('연달아 지우면 앞 삭제는 바로 확정된다 — 토스트와 되돌릴 대상이 1:1 (#1677 리뷰)', async () => {
  const { result, deletes } = await setup({ count: 2 });
  const [a, b] = result.current.routines.map((r) => r.id);
  await act(async () => result.current.deleteRoutineUndoable(a));
  expect(deletes).toHaveLength(0);
  await act(async () => result.current.deleteRoutineUndoable(b));
  // 앞(A)의 토스트는 B 토스트로 덮였다 — 버튼 없는 5초를 기다리지 않고 지금 지운다.
  await waitFor(() => expect(deletes).toEqual([expect.stringContaining('/todos/7')]));
  // B는 아직 되돌릴 수 있다.
  const undoB = mockToast.mock.calls.at(-1)![2].action.onPress as () => void;
  await act(async () => undoB());
  expect(result.current.routines.map((r) => r.id)).toEqual([b]);
});

it('화면이 사라지면 남은 삭제를 확정한다 — 되돌릴 사람이 없다', async () => {
  const { result, deletes, id, unmount } = await setup();
  await act(async () => result.current.deleteRoutineUndoable(id));
  await unmount();
  await waitFor(() => expect(deletes).toHaveLength(1));
});

it('서버 삭제 요청이 나가 있는 동안 다시 불러와도 되살아나지 않는다 (#1677 리뷰)', async () => {
  let release!: () => void;
  const holdDelete = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { result, id } = await setup({ holdDelete });
  await act(async () => result.current.deleteRoutineUndoable(id));
  // 백그라운드 → 확정 요청이 나갔지만 서버엔 아직 있다.
  await act(async () => appStateListener?.('background'));
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.routines).toHaveLength(0);
  await act(async () => release());
});

it('다른 토스트가 실행 취소 토스트를 덮으면 기다리지 않고 확정한다 (#1677 리뷰)', async () => {
  const { result, deletes, id } = await setup();
  await act(async () => result.current.deleteRoutineUndoable(id));
  const onDismiss = mockToast.mock.calls.at(-1)![2].onDismiss as () => void;
  await act(async () => onDismiss());
  await waitFor(() => expect(deletes).toHaveLength(1));
});

it('서버 삭제 요청이 나가 있는 동안·끝난 직후에도 달력 날짜 목록에 되살아나지 않는다 (#1677 리뷰)', async () => {
  let release!: () => void;
  const holdDelete = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { result, id } = await setup({ holdDelete });
  const day = '2026-12-01';
  await act(async () => {
    await result.current.loadCalendarDay(day);
  });
  await waitFor(() => expect(result.current.calendarDays[day]?.map((c) => c.id)).toEqual([id]));
  await act(async () => result.current.deleteRoutineUndoable(id));
  expect(result.current.calendarDays[day]).toEqual([]);
  // 확정 요청이 나갔지만 서버엔 아직 있다.
  await act(async () => appStateListener?.('background'));
  expect(result.current.calendarDays[day]).toEqual([]);
  // 요청이 끝난 뒤, 월 목록을 다시 받기 전에도 숨긴 채로.
  await act(async () => release());
  expect(result.current.calendarDays[day]).toEqual([]);
});

it('서버 삭제가 실패하면 달력 날짜 목록에도 돌아온다 (#1677 리뷰)', async () => {
  const { result, id } = await setup({ failDelete: true });
  const day = '2026-12-01';
  await act(async () => {
    await result.current.loadCalendarDay(day);
  });
  await waitFor(() => expect(result.current.calendarDays[day]?.map((c) => c.id)).toEqual([id]));
  await act(async () => result.current.deleteRoutineUndoable(id));
  await act(async () => appStateListener?.('background'));
  await waitFor(() => expect(result.current.calendarDays[day]?.map((c) => c.id)).toEqual([id]));
});
