import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRecommendations } from '@/hooks/use-recommendations';
import { queryWrapper } from '@/test-utils/query-wrapper';

const res = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(body),
});

const ITEM = {
  recommendationId: 1,
  type: 'ADJUST_DAYS',
  message: '『아침 러닝』 수요일 수행이 3주 연속 실패했어요.',
  routineId: 42,
  originRoutineId: 42,
  routineTitle: '아침 러닝',
  proposal: { repeatType: 'WEEKLY', daysOfWeek: ['MON', 'FRI'] },
  expiresAt: '2026-09-05T00:00:00',
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useRecommendations', () => {
  it('마운트하면 활성 추천을 불러온다', async () => {
    global.fetch = jest.fn(async () => res({ items: [ITEM] })) as unknown as typeof global.fetch;
    const { result } = await renderHook(() => useRecommendations(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].routineTitle).toBe('아침 러닝');
  });

  it('목록 조회가 실패해도 빈 목록으로 접는다 — 추천은 부가 정보다', async () => {
    global.fetch = jest.fn(async () => res({}, 500)) as unknown as typeof global.fetch;
    const { result } = await renderHook(() => useRecommendations(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.items).toEqual([]));
  });

  it('수락하면 카드를 걷고 루틴 재조회를 알린다 — id가 바뀌기 때문', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      calls.push(String(url));
      return String(url).includes('/accept') ? res({ id: 99 }) : res({ items: [ITEM] });
    }) as unknown as typeof global.fetch;
    const onAccepted = jest.fn();
    const { result } = await renderHook(() => useRecommendations({ onAccepted }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.accept(1);
    });
    expect(calls.some((u) => u.endsWith('/recommendations/1/accept'))).toBe(true);
    // react-query는 리렌더 알림을 notifyManager가 배칭하므로 즉시 단언하면
    // 직전 값을 본다 — 캐시 반영을 기다린다.
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(onAccepted).toHaveBeenCalled();
  });

  it('수락이 실패하면(만료·선행 수정 등) 목록을 다시 받는다', async () => {
    let listCalls = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/accept')) return res({ code: 'RECOMMENDATION_EXPIRED' }, 409);
      listCalls += 1;
      return res({ items: [ITEM] });
    }) as unknown as typeof global.fetch;
    const onAccepted = jest.fn();
    const { result } = await renderHook(() => useRecommendations({ onAccepted }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.accept(1);
    });
    // 재조회로 서버의 현재 상태를 다시 받는다 — 카드는 서버가 판단한다.
    expect(listCalls).toBeGreaterThan(1);
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('무시하면 카드만 사라지고 루틴은 건드리지 않는다', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      calls.push(String(url));
      return String(url).includes('/dismiss') ? res({}, 204) : res({ items: [ITEM] });
    }) as unknown as typeof global.fetch;
    const onAccepted = jest.fn();
    const { result } = await renderHook(() => useRecommendations({ onAccepted }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.dismiss(1);
    });
    expect(calls.some((u) => u.endsWith('/recommendations/1/dismiss'))).toBe(true);
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(onAccepted).not.toHaveBeenCalled();
  });
});
