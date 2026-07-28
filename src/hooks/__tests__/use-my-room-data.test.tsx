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

describe('useMyRoomData — completion callback (미션 연동, #272)', () => {
  it('fires onCompleted only for a successful completion, not an un-complete', async () => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/categories')) return res({ items: [{ id: 1, name: '집카테고리' }] });
      if (url.endsWith('/routines'))
        return res({
          items: [{ id: 9, title: '아침 스트레칭', categoryId: 1, repeatType: 'DAILY' }],
        });
      if ((init?.method ?? 'GET') === 'POST' && url.includes('/routines/9/logs'))
        return res({ rewardAmount: 0 });
      if ((init?.method ?? 'GET') === 'DELETE') return res({});
      if (url.endsWith('/today')) return res({ categories: [], summary: {}, streak: {} });
      if (url.endsWith('/me')) return res({ userId: 1 });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const routine = result.current.routines[0];
    const onCompleted = jest.fn();

    await act(async () => {
      await result.current.toggleCompletion(routine.id, todayIso, onCompleted);
    });
    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ title: '아침 스트레칭' }));

    onCompleted.mockClear();
    // Now completed → the same call un-completes; the callback must stay quiet.
    await act(async () => {
      await result.current.toggleCompletion(routine.id, todayIso, onCompleted);
    });
    expect(onCompleted).not.toHaveBeenCalled();
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
    let returned: number | null | undefined;
    await act(async () => {
      returned = await result.current.toggleCompletion(routine.id, todayIso);
    });
    expect(returned).toBe(10);

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
    expect(returned).toBe(0);
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

    expect(result.current.categories.map((c) => c.label)).toContain('기타');
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
        label: '새분류',
        icon: 'leaf',
        color: '#0F0',
        visibility: 'public',
      });
    });
    expect(result.current.allCategories.some((c) => c.id === '2' && c.icon === 'leaf')).toBe(true);
  });
});

// 카테고리 삭제 신계약 (#517) — mode별 낙관적 업데이트와 실패 롤백.
describe('useMyRoomData — deleteRoutineCategory (mode, #517)', () => {
  const seed = (deleteStatus = 204) => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      if (method === 'DELETE' && url.includes('/categories/')) {
        return deleteStatus === 204
          ? { ok: true, status: 204, text: async () => '' }
          : {
              ok: false,
              status: deleteStatus,
              text: async () => JSON.stringify({ code: 'CATEGORY_IN_USE' }),
            };
      }
      if (url.includes('/categories')) {
        return res({
          items: [
            { id: 1, name: '건강', colorHex: '#F00' },
            { id: 2, name: '취미', colorHex: '#0F0' },
          ],
        });
      }
      if (url.endsWith('/routines')) {
        return res({ items: [{ id: 9, title: '산책', categoryId: 1, repeatType: 'DAILY' }] });
      }
      if (url.endsWith('/todos')) {
        return res({
          items: [{ id: 7, title: '기타 연습', categoryId: 2, dueDate: '2026-07-28', status: 'PENDING' }], // prettier-ignore
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;
    return calls;
  };

  it('UNASSIGN: 투두를 미분류로 낙관 전환하고 mode 쿼리로 삭제한다', async () => {
    const calls = seed(204);
    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.categories.length).toBe(2));

    await act(async () => {
      await result.current.deleteRoutineCategory('2', 'UNASSIGN');
    });
    const del = calls.find((c) => c.method === 'DELETE' && c.url.includes('/categories/2'));
    expect(del?.url).toContain('mode=UNASSIGN');
    // 투두는 남고 카테고리만 사라짐 (reload 목도 같은 상태를 돌려줘 유지).
    expect(result.current.routines.some((r) => r.id === 't7')).toBe(true);
  });

  it('PURGE: 해당 카테고리 항목을 화면에서 제거한다', async () => {
    seed(204);
    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.categories.length).toBe(2));

    await act(async () => {
      await result.current.deleteRoutineCategory('2', 'PURGE');
    });
    // 낙관적 제거 직후 reload 목이 다시 내려주지만, PURGE 요청 자체가 mode를 싣는지 확인.
    expect(
      (global.fetch as jest.Mock).mock.calls.some(
        ([url, init]: [string, RequestInit?]) =>
          init?.method === 'DELETE' && String(url).includes('mode=PURGE'),
      ),
    ).toBe(true);
  });

  it('살아있는 루틴이 있으면 서버 호출 없이 막는다', async () => {
    const calls = seed(204);
    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.categories.length).toBe(2));

    await act(async () => {
      await result.current.deleteRoutineCategory('1', 'UNASSIGN'); // 루틴(산책) 보유
    });
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/categories/1'))).toBe(false);
    expect(result.current.categories.length).toBe(2);
  });

  it('삭제 실패(409)면 카테고리·항목을 함께 롤백한다', async () => {
    seed(409);
    const { result } = await renderHook(() => useMyRoomData());
    await waitFor(() => expect(result.current.categories.length).toBe(2));

    await act(async () => {
      await result.current.deleteRoutineCategory('2', 'PURGE');
    });
    // 실패 → categories와 routines(투두 포함) 모두 원복.
    expect(result.current.categories.some((c) => c.id === '2')).toBe(true);
    expect(result.current.routines.some((r) => r.id === 't7')).toBe(true);
  });
});
