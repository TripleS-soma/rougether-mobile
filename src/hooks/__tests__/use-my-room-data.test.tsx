import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useMyRoomData } from '@/hooks/use-my-room-data';

// Server state: no categories, two routines with categoryId null (legacy data).
// The hook must adopt them into a freshly created 기타 category — uncategorized
// routines must not exist.
const res = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useMyRoomData — completion routing on id collision', () => {
  it('completes the todo (not the same-numbered routine) when server ids collide', async () => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const calls: { url: string; method: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      if (url.includes('/categories')) {
        return res({ items: [{ id: 1, name: '건강', colorHex: '#F00' }] });
      }
      if (url.endsWith('/routines')) {
        return res({
          items: [{ id: 5, title: '같은번호 루틴', categoryId: 1, repeatType: 'DAILY' }],
        });
      }
      if (url.endsWith('/todos')) {
        return res({
          items: [
            { id: 5, title: '같은번호 투두', categoryId: 1, dueDate: todayIso, status: 'PENDING' },
          ],
        });
      }
      if (method === 'POST' && url.endsWith('/todos/5/complete')) {
        return res({ id: 5, status: 'COMPLETED', rewardAmount: 10 });
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const todo = result.current.routines.find((r) => r.kind === 'todo')!;
    await result.current.toggleCompletion(todo.id, todayIso);

    // The todo endpoint is hit — never the routine-log endpoint for id 5.
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/todos/5/complete'))).toBe(
      true,
    );
    expect(calls.some((c) => c.url.includes('/routines/5/logs'))).toBe(false);
  });
});

describe('useMyRoomData — 완료 응답의 서버 자동 미션 기여 (#578)', () => {
  it('surfaces houseMissionContribution on a completion, null result on un-complete', async () => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/categories'))
        return res({ items: [{ id: 1, name: '집카테고리', houseId: 2 }] });
      if (url.endsWith('/routines'))
        return res({
          items: [
            { id: 9, title: '아침 스트레칭', categoryId: 1, repeatType: 'DAILY', houseMissionId: 6 }, // prettier-ignore
          ],
        });
      if ((init?.method ?? 'GET') === 'POST' && url.includes('/routines/9/logs'))
        return res({
          rewardAmount: 0,
          houseMissionContribution: { missionId: 6, myContribution: 1, currentValue: 3, achieved: false }, // prettier-ignore
        });
      if ((init?.method ?? 'GET') === 'DELETE') return res({});
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1 });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const routine = result.current.routines[0];
    // 링크 id가 앱 모델까지 내려온다.
    expect(routine.linkedMissionId).toBe(6);

    let returned: Awaited<ReturnType<typeof result.current.toggleCompletion>> = null;
    await act(async () => {
      returned = await result.current.toggleCompletion(routine.id, todayIso);
    });
    // 완료 응답의 자동 기여 결과가 그대로 실려 나온다 — 셸이 집 상태에 반영.
    expect(returned).toMatchObject({
      rewardAmount: 0,
      houseMissionContribution: { missionId: 6, currentValue: 3 },
    });

    // 해제는 기여와 무관 — null (기여 회수 없음).
    await act(async () => {
      returned = await result.current.toggleCompletion(routine.id, todayIso);
    });
    expect(returned).toBeNull();
  });
});

describe('useMyRoomData — 코인 상한 피드백 (#444)', () => {
  it('보상이 있으면 보상액을 반환하고, 상한 도달(보상 0)이면 0 반환 + 상한 토스트', async () => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let reward = 10;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/categories')) return res({ items: [{ id: 1, name: '건강' }] });
      if (url.endsWith('/routines'))
        return res({ items: [{ id: 9, title: '운동', categoryId: 1, repeatType: 'DAILY' }] });
      if ((init?.method ?? 'GET') === 'POST' && url.includes('/routines/9/logs'))
        return res({ rewardAmount: reward });
      if ((init?.method ?? 'GET') === 'DELETE') return res({});
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1 });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const routine = result.current.routines[0];

    // 보상 있는 완료 → 보상액 반환 (화면은 이 값으로 코인을 발사한다).
    let returned: Awaited<ReturnType<typeof result.current.toggleCompletion>> = null;
    await act(async () => {
      returned = await result.current.toggleCompletion(routine.id, todayIso);
    });
    expect(returned).toMatchObject({ rewardAmount: 10 });

    // 해제 → null (코인 없음).
    await act(async () => {
      returned = await result.current.toggleCompletion(routine.id, todayIso);
    });
    expect(returned).toBeNull();

    // 상한 도달(보상 0) 완료 → 0 반환 (코인 억제).
    reward = 0;
    await act(async () => {
      returned = await result.current.toggleCompletion(routine.id, todayIso);
    });
    expect(returned).toMatchObject({ rewardAmount: 0 });
  });
});

describe('useMyRoomData — 달력 past-date routine completion (#183)', () => {
  it('logs a past routine against the picked date and refetches the day', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (method === 'POST' && url.endsWith('/routines/7/logs')) {
        return res({ routineId: 7, routineDate: '2026-07-10', rewardAmount: 0 });
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터' });
      if (url.includes('/calendar')) return res({ categories: [], summary: {} });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.toggleCalendarItem(
      { id: '7', kind: 'routine', title: '지난 루틴', completed: false, category: '' },
      '2026-07-10',
    );

    // The dated routine-log endpoint is hit with the picked (past) date…
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/routines/7/logs'));
    expect(JSON.parse(post?.body ?? '{}').routineDate).toBe('2026-07-10');
    // …and the day is refetched so the list mirrors the server.
    expect(calls.some((c) => c.url.includes('/calendar') && c.url.includes('2026-07-10'))).toBe(
      true,
    );
  });

  it('deletes a past routine log on uncheck', async () => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터' });
      if (url.includes('/calendar')) return res({ categories: [], summary: {} });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.toggleCalendarItem(
      { id: '7', kind: 'routine', title: '지난 루틴', completed: true, category: '' },
      '2026-07-10',
    );

    expect(
      calls.some(
        (c) =>
          c.method === 'DELETE' &&
          c.url.includes('/routines/7/logs') &&
          c.url.includes('2026-07-10'),
      ),
    ).toBe(true);
  });
});

describe('useMyRoomData — profile save (PUT /me)', () => {
  it('seeds bio from /me and sends nickname+bio on saveProfile', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (method === 'PUT' && url.endsWith('/me')) {
        return res({ userId: 1, nickname: '새닉', bio: '새 소개' });
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터', bio: '기존 소개' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // bio seeds from GET /me.
    expect(result.current.bio).toBe('기존 소개');

    await result.current.saveProfile('새닉', '새 소개');

    const put = calls.find((c) => c.method === 'PUT' && c.url.endsWith('/me'));
    expect(JSON.parse(put?.body ?? '{}')).toEqual({ nickname: '새닉', bio: '새 소개' });
    await waitFor(() => expect(result.current.nickname).toBe('새닉'));
    expect(result.current.bio).toBe('새 소개');
  });

  it('rolls back nickname and bio when PUT /me fails', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'PUT' && url.endsWith('/me')) {
        return { ok: false, status: 500, text: async () => '{}' };
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터', bio: '기존 소개' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const ok = await result.current.saveProfile('새닉', '새 소개');

    expect(ok).toBe(false);
    expect(result.current.nickname).toBe('테스터');
    expect(result.current.bio).toBe('기존 소개');
  });
});

describe('useMyRoomData — uncategorized adoption', () => {
  it('creates a 기타 category and reassigns orphan routines on load', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });

      if (method === 'POST' && url.endsWith('/categories')) {
        return res({ id: 9, name: '기타', colorHex: '#B5A89C', iconKey: '✨' });
      }
      if (method === 'PUT' && /\/routines\/\d+$/.test(url)) {
        return res({ id: 2, title: '아침 기상', categoryId: 9 });
      }
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1, nickname: '테스터' });
      if (url.endsWith('/routines')) {
        return res({
          items: [
            { id: 2, title: '아침 기상', categoryId: null, repeatType: 'DAILY' },
            { id: 3, title: '독서 30분', categoryId: null, repeatType: 'DAILY' },
          ],
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // A real 기타 category was created server-side…
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/categories'))).toBe(true);
    // …and both orphans were reassigned to it.
    const puts = calls.filter((c) => c.method === 'PUT' && /\/routines\/\d+$/.test(c.url));
    expect(puts).toHaveLength(2);
    expect(JSON.parse(puts[0].body ?? '{}').categoryId).toBe(9);

    expect(result.current.categories.map((c) => c.name)).toContain('기타');
    expect(result.current.routines.every((r) => r.category === '9')).toBe(true);
  });
});

describe('useMyRoomData — 카테고리 메타를 달력 소스(allCategories)에도 동기화 (#481)', () => {
  // 달력 서버 날짜 그룹은 allCategories로 아이콘/이름/색을 해석하므로,
  // 카테고리 수정·생성이 categories에만 반영되면 달력만 stale해진다.
  const catFetch = () =>
    jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url.includes('/categories') && method === 'GET')
        return res({ items: [{ id: 1, name: '건강', colorHex: '#F00', iconKey: 'dumbbell' }] });
      if (url.includes('/categories') && method === 'POST')
        return res({ id: 2, name: '새분류', colorHex: '#0F0', iconKey: 'leaf' });
      if (url.includes('/categories') && method === 'PUT') return res({ id: 1 });
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1 });
      return res({ items: [] });
    }) as unknown as typeof fetch;

  it('카테고리 수정(아이콘 등)이 allCategories에도 반영된다', async () => {
    global.fetch = catFetch();
    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const cat = result.current.categories[0];
    expect(result.current.allCategories.find((c) => c.id === cat.id)?.icon).toBe('dumbbell');

    await act(async () => {
      await result.current.updateRoutineCategory(cat.id, { ...cat, icon: 'leaf' });
    });
    expect(result.current.categories.find((c) => c.id === cat.id)?.icon).toBe('leaf');
    expect(result.current.allCategories.find((c) => c.id === cat.id)?.icon).toBe('leaf');
  });

  it('새 카테고리가 allCategories에도 추가된다', async () => {
    global.fetch = catFetch();
    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createRoutineCategory({
        id: '',
        name: '새분류',
        icon: 'leaf',
        color: '#0F0',
        visibility: 'public',
      });
    });
    expect(result.current.allCategories.some((c) => c.id === '2' && c.icon === 'leaf')).toBe(true);
  });
});

describe('useMyRoomData — 달력 월 점 (#838)', () => {
  /**
   * 서버(#295)는 routineCount와 todoCount를 둘 다 주지만 **투두만** 점이 된다.
   * 루틴은 대부분의 날에 반복되므로 점을 찍으면 거의 모든 날에 찍혀 아무것도
   * 구분하지 못한다 — 이 규칙이 이 기능의 전부다.
   */
  it('투두가 있는 날만 표시하고 루틴만 있는 날은 뺀다', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/calendar/month')) {
        return res({
          yearMonth: '2026-08',
          days: [
            { date: '2026-08-01', routineCount: 3, todoCount: 0 }, // 루틴만 → 점 없음
            { date: '2026-08-02', routineCount: 3, todoCount: 1 }, // 투두 있음 → 점
            { date: '2026-08-03', routineCount: 0, todoCount: 2 }, // 투두만 → 점
            { date: '2026-08-04', routineCount: 0, todoCount: 0 }, // 아무것도 없음
          ],
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await act(async () => {
      await result.current.loadCalendarMonth('2026-08');
    });

    expect([...result.current.markedTodoDates].sort()).toEqual(['2026-08-02', '2026-08-03']);
  });

  it('여러 달을 오가도 받은 달이 누적된다', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/calendar/month')) {
        const ym = url.includes('2026-07') ? '2026-07' : '2026-08';
        return res({ yearMonth: ym, days: [{ date: `${ym}-05`, routineCount: 0, todoCount: 1 }] });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await act(async () => {
      await result.current.loadCalendarMonth('2026-08');
      await result.current.loadCalendarMonth('2026-07');
    });

    expect([...result.current.markedTodoDates].sort()).toEqual(['2026-07-05', '2026-08-05']);
  });

  it('월 조회 실패는 조용히 넘어간다 — 점은 보조 정보다', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/calendar/month'))
        return { ok: false, status: 500, text: async () => '{}' };
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await act(async () => {
      await result.current.loadCalendarMonth('2026-08');
    });

    expect(result.current.markedTodoDates.size).toBe(0);
  });
});
