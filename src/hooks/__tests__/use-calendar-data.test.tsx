import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useCalendarData } from '@/hooks/use-calendar-data';
import type { Routine } from '@/constants/routines';
import { jsonRes as res } from '@/test-utils/fetch';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

const NO_ROUTINES: Routine[] = [];

/** GET /calendar?date= 응답 — 루틴 1개(미완료) + 투두 1개(완료). */
const DAY = {
  date: '2026-07-10',
  categories: [
    {
      categoryId: 1,
      routines: [{ id: 7, title: '지난 루틴', completed: false, scheduledTime: '07:00:00' }],
      todos: [{ id: 3, title: '지난 할 일', status: 'COMPLETED' }],
    },
  ],
  summary: {},
};

type Call = { url: string; method: string; body?: string };

/** 기본 서버 — 달력 날짜·달·완료 로그·지갑에 응답하고 호출을 기록한다. */
const harness = (over: (url: string, method: string) => unknown = () => undefined) => {
  const calls: Call[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    const custom = over(url, method);
    if (custom !== undefined) return custom;
    if (url.includes('/calendar/month')) {
      return res({
        yearMonth: '2026-07',
        days: [
          { date: '2026-07-01', routineCount: 3, todoCount: 0 }, // 루틴만 → 점 없음
          { date: '2026-07-02', routineCount: 3, todoCount: 1 }, // 투두 있음 → 점
          { date: '2026-07-03', routineCount: 0, todoCount: 2 }, // 투두만 → 점
        ],
      });
    }
    if (url.includes('/calendar')) return res(DAY);
    if (url.includes('/routines/7/logs')) return res({ routineId: 7, rewardAmount: 0 });
    if (url.endsWith('/todos/3/complete')) return res({ id: 3, rewardAmount: 10 });
    return res({ items: [] });
  }) as unknown as typeof fetch;
  return calls;
};

const dayFetches = (calls: Call[], date: string) =>
  calls.filter((c) => c.url.includes('/calendar?') && c.url.includes(date)).length;

const render = (refreshWallet = jest.fn(async () => {}), client = createTestQueryClient()) =>
  renderHook(() => useCalendarData({ routines: NO_ROUTINES, refreshWallet }), {
    wrapper: queryWrapper(client),
  });

describe('useCalendarData — 날짜 조회', () => {
  it('고른 날짜를 받아 화면 모양으로 캐시하고, 다시 고르면 항상 다시 받는다', async () => {
    const calls = harness();
    const { result } = await render();
    expect(result.current.calendarDays).toEqual({});

    await act(async () => {
      await result.current.loadCalendarDay('2026-07-10');
    });
    await waitFor(() =>
      expect(result.current.calendarDays['2026-07-10']).toEqual([
        { id: 'r7', kind: 'routine', title: '지난 루틴', time: '07:00', completed: false, category: '1' }, // prettier-ignore
        { id: 't3', kind: 'todo', title: '지난 할 일', time: undefined, completed: true, category: '1' }, // prettier-ignore
      ]),
    );
    // 관찰자와 명시 조회가 같은 요청을 나눠 쓴다 — 한 번만 나간다.
    expect(dayFetches(calls, '2026-07-10')).toBe(1);

    // 루틴 수정이 미래 날짜를 바꾸므로 다시 고르면 다시 받는다.
    await act(async () => {
      await result.current.loadCalendarDay('2026-07-10');
    });
    expect(dayFetches(calls, '2026-07-10')).toBe(2);
  });

  it('조회 실패는 토스트만 — 이전 데이터가 남는다', async () => {
    let fail = false;
    harness((url) => (fail && url.includes('/calendar?') ? res({}, 500) : undefined));
    const { result } = await render();
    await act(async () => {
      await result.current.loadCalendarDay('2026-07-10');
    });
    await waitFor(() => expect(result.current.calendarDays['2026-07-10']).toHaveLength(2));

    fail = true;
    await act(async () => {
      await result.current.loadCalendarDay('2026-07-10');
    });
    expect(result.current.calendarDays['2026-07-10']).toHaveLength(2);
  });

  it('참조 계약 (#539) — 내용이 같으면 calendarDays·콜백 참조가 고정된다', async () => {
    harness();
    const { result, rerender } = await render();
    const before = result.current;
    rerender({});
    expect(result.current.calendarDays).toBe(before.calendarDays);
    expect(result.current.loadCalendarDay).toBe(before.loadCalendarDay);
    expect(result.current.toggleCalendarItem).toBe(before.toggleCalendarItem);
    expect(result.current.invalidateCalendar).toBe(before.invalidateCalendar);
  });
});

describe('useCalendarData — 달 점 (#838)', () => {
  it('투두가 있는 날만 표시하고 루틴만 있는 날은 뺀다', async () => {
    harness();
    const { result } = await render();
    await act(async () => {
      await result.current.loadCalendarMonth('2026-07');
    });
    await waitFor(() =>
      expect([...result.current.markedTodoDates].sort()).toEqual(['2026-07-02', '2026-07-03']),
    );
  });

  it('앱이 든 투두의 날짜·요청 중인 날짜를 합치고, unmarkTodoDate는 달 캐시에서 걷는다', async () => {
    harness();
    const refreshWallet = jest.fn(async () => {});
    const routines: Routine[] = [
      { id: 't9', kind: 'todo', title: '치과', category: '1', days: [], dueDate: '2026-07-20', alarmEnabled: false, time: '' } as unknown as Routine, // prettier-ignore
    ];
    const { result } = await renderHook(() => useCalendarData({ routines, refreshWallet }), {
      wrapper: queryWrapper(),
    });
    await act(async () => {
      await result.current.loadCalendarMonth('2026-07');
    });
    await waitFor(() => expect(result.current.markedTodoDates.has('2026-07-20')).toBe(true));

    await act(async () => {
      result.current.markPending('2026-07-25');
    });
    expect(result.current.markedTodoDates.has('2026-07-25')).toBe(true);
    await act(async () => {
      result.current.unmarkPending('2026-07-25');
    });
    expect(result.current.markedTodoDates.has('2026-07-25')).toBe(false);

    await act(async () => {
      result.current.unmarkTodoDate('2026-07-02');
    });
    await waitFor(() => expect(result.current.markedTodoDates.has('2026-07-02')).toBe(false));
    expect(result.current.markedTodoDates.has('2026-07-03')).toBe(true);
  });

  it('월 조회 실패는 조용히 넘어간다 — 점은 보조 정보다', async () => {
    harness((url) => (url.includes('/calendar/month') ? res({}, 500) : undefined));
    const { result } = await render();
    await act(async () => {
      await result.current.loadCalendarMonth('2026-07');
    });
    expect(result.current.markedTodoDates.size).toBe(0);
  });
});

describe('useCalendarData — 완료 토글', () => {
  it('응답 뒤 그 항목을 뒤집고, 달력 전체를 무효화하고, 지갑 콜백을 부른다', async () => {
    const calls = harness();
    const refreshWallet = jest.fn(async () => {});
    const { result } = await render(refreshWallet);
    await act(async () => {
      await result.current.loadCalendarDay('2026-07-10');
      await result.current.loadCalendarDay('2026-07-11');
      await result.current.loadCalendarMonth('2026-07');
    });
    await waitFor(() => expect(Object.keys(result.current.calendarDays)).toHaveLength(2));
    const monthFetches = () => calls.filter((c) => c.url.includes('/calendar/month')).length;
    expect(dayFetches(calls, '2026-07-10')).toBe(1);
    expect(dayFetches(calls, '2026-07-11')).toBe(1);
    expect(monthFetches()).toBe(1);

    const item = result.current.calendarDays['2026-07-10'][0];
    await act(async () => {
      await result.current.toggleCalendarItem(item, '2026-07-10');
    });

    // 과거 날짜 루틴은 날짜를 실어 로그한다 (#183).
    const post = calls.find((c) => c.method === 'POST' && c.url.includes('/routines/7/logs'));
    expect(JSON.parse(post?.body ?? '{}').routineDate).toBe('2026-07-10');
    // 방문한 날짜·달이 전부 다시 조회된다 — 종전 refreshCachedCalendarDays의 자리.
    expect(dayFetches(calls, '2026-07-10')).toBe(2);
    expect(dayFetches(calls, '2026-07-11')).toBe(2);
    expect(monthFetches()).toBe(2);
    expect(refreshWallet).toHaveBeenCalledTimes(1);
  });

  it('재조회가 오기 전에도 캐시의 그 항목이 뒤집혀 있다', async () => {
    let holdRefetch = false;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness((url) => {
      if (holdRefetch && url.includes('/calendar?')) return gate.then(() => res(DAY));
      return undefined;
    });
    const { result } = await render();
    await act(async () => {
      await result.current.loadCalendarDay('2026-07-10');
    });
    await waitFor(() => expect(result.current.calendarDays['2026-07-10']).toHaveLength(2));

    holdRefetch = true;
    const item = result.current.calendarDays['2026-07-10'][0];
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.toggleCalendarItem(item, '2026-07-10');
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(result.current.calendarDays['2026-07-10'][0]).toMatchObject({ completed: true }),
    );
    await act(async () => {
      release();
      await pending;
    });
    // 서버 응답(미완료)이 최종값 — 목록은 서버를 비춘다.
    await waitFor(() =>
      expect(result.current.calendarDays['2026-07-10'][0]).toMatchObject({ completed: false }),
    );
  });

  it('투두 완료 취소는 상태만 뒤집는다(날짜 무관) — 실패는 토스트로 접고 던지지 않는다', async () => {
    const calls = harness((url, method) =>
      method === 'DELETE' && url.endsWith('/todos/3/complete') ? res({}, 500) : undefined,
    );
    const refreshWallet = jest.fn(async () => {});
    const { result } = await render(refreshWallet);
    await act(async () => {
      await result.current.loadCalendarDay('2026-07-10');
    });
    await waitFor(() => expect(result.current.calendarDays['2026-07-10']).toHaveLength(2));

    const todo = result.current.calendarDays['2026-07-10'][1];
    await act(async () => {
      await expect(result.current.toggleCalendarItem(todo, '2026-07-10')).resolves.toBeUndefined();
    });
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/todos/3/complete'))).toBe(
      true,
    );
    // 실패 — 캐시도 지갑도 손대지 않는다.
    expect(result.current.calendarDays['2026-07-10'][1]).toMatchObject({ completed: true });
    expect(refreshWallet).not.toHaveBeenCalled();
    expect(dayFetches(calls, '2026-07-10')).toBe(1);
  });
});

describe('useCalendarData — invalidateCalendar', () => {
  it('방문한 날짜·달만 다시 받는다', async () => {
    const calls = harness();
    const { result } = await render();
    await act(async () => {
      await result.current.loadCalendarDay('2026-07-10');
      await result.current.loadCalendarMonth('2026-07');
    });
    await waitFor(() => expect(result.current.calendarDays['2026-07-10']).toHaveLength(2));
    const before = calls.length;

    await act(async () => {
      result.current.invalidateCalendar();
    });
    await waitFor(() => expect(dayFetches(calls, '2026-07-10')).toBe(2));
    await waitFor(() =>
      expect(calls.filter((c) => c.url.includes('/calendar/month')).length).toBe(2),
    );
    // 그 둘 말고는 아무것도 안 나간다.
    expect(calls.length - before).toBe(2);
  });
});
