import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  recentCompletionDates,
  toCompletionGroups,
  useRecentRoutineCompletions,
} from '@/hooks/use-recent-routine-completions';
import { jsonRes } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

// 기기 시간대와 무관하게 — "오늘"은 픽스처로 준다(CI는 UTC). 월 경계를 넘는 창으로 고른다.
const TODAY = '2026-10-02';

describe('recentCompletionDates', () => {
  it('KST 오늘부터 하루씩 거슬러 7일 — 월 경계를 넘는다', () => {
    expect(recentCompletionDates(TODAY)).toEqual([
      '2026-10-02',
      '2026-10-01',
      '2026-09-30',
      '2026-09-29',
      '2026-09-28',
      '2026-09-27',
      '2026-09-26',
    ]);
  });

  it('연말도 넘는다', () => {
    expect(recentCompletionDates('2027-01-03', 4)).toEqual([
      '2027-01-03',
      '2027-01-02',
      '2027-01-01',
      '2026-12-31',
    ]);
  });
});

describe('toCompletionGroups', () => {
  it('완료한 루틴만, 날짜 순서대로 묶고 빈 날은 뺀다', () => {
    const groups = toCompletionGroups([
      {
        date: '2026-10-02',
        items: [
          { id: 'r15', kind: 'routine', title: '아침 스트레칭', completed: true },
          { id: 'r16', kind: 'routine', title: '물 마시기', completed: false },
          { id: 't3', kind: 'todo', title: '장보기', completed: true },
          { id: 'r15', kind: 'routine', title: '아침 스트레칭', completed: true },
        ],
      },
      undefined,
      {
        date: '2026-09-30',
        items: [{ id: 'r16', kind: 'routine', title: '물', completed: false }],
      },
      {
        date: '2026-09-29',
        items: [{ id: 'r16', kind: 'routine', title: '물 마시기', completed: true }],
      },
    ]);
    expect(groups).toEqual([
      {
        date: '2026-10-02',
        options: [{ routineId: 15, title: '아침 스트레칭', date: '2026-10-02' }],
      },
      { date: '2026-09-29', options: [{ routineId: 16, title: '물 마시기', date: '2026-09-29' }] },
    ]);
  });
});

describe('useRecentRoutineCompletions (#1456)', () => {
  it('enabled=false면 요청하지 않는다', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = await renderHook(
      () => useRecentRoutineCompletions({ enabled: false, today: TODAY }),
      { wrapper: queryWrapper() },
    );
    expect(result.current).toMatchObject({ groups: [], loading: false, error: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('7일의 /calendar를 받아 완료 루틴을 날짜별로 묶는다', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      const date = new URL(url).searchParams.get('date');
      const routines =
        date === '2026-10-02'
          ? [
              { id: 15, title: '아침 스트레칭', completed: true },
              { id: 16, title: '물 마시기', completed: false },
            ]
          : date === '2026-09-26'
            ? [{ id: 16, title: '물 마시기', completed: true }]
            : [];
      return jsonRes({ date, categories: [{ categoryId: 1, routines, todos: [] }] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = await renderHook(
      () => useRecentRoutineCompletions({ enabled: true, today: TODAY }),
      { wrapper: queryWrapper() },
    );
    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    const requested = fetchMock.mock.calls.map(([url]) => new URL(url).searchParams.get('date'));
    expect(requested.sort()).toEqual(recentCompletionDates(TODAY).sort());
    expect(result.current.groups).toEqual([
      {
        date: '2026-10-02',
        options: [{ routineId: 15, title: '아침 스트레칭', date: '2026-10-02' }],
      },
      { date: '2026-09-26', options: [{ routineId: 16, title: '물 마시기', date: '2026-09-26' }] },
    ]);
    expect(result.current.loading).toBe(false);
  });

  it('돌려주는 객체는 데이터가 같으면 참조가 고정된다 (#539)', async () => {
    global.fetch = jest.fn(async (url: string) =>
      jsonRes({ date: new URL(url).searchParams.get('date'), categories: [] }),
    ) as unknown as typeof fetch;
    const { result, rerender } = await renderHook(
      () => useRecentRoutineCompletions({ enabled: true, today: TODAY }),
      { wrapper: queryWrapper() },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const first = result.current;
    await act(async () => {
      await rerender({});
    });
    expect(result.current).toBe(first);
  });
});
