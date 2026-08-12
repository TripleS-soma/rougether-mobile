import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { ShopCatalogue } from '@/api/adapters';
import { useFriendRoom } from '@/hooks/use-friend-room';

const res = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});

const CATALOGUE: ShopCatalogue = {
  furniture: [
    { id: '2', name: '침대', slot: 'bottomLeft', category: '가구', price: 0, assetKey: 'items/a/bed.png' }, // prettier-ignore
  ],
  wallpapers: [{ id: '9', name: '벽지', price: 0, assetKey: 'items/a/wp.png', color: '#FFF' }],
  floors: [],
  backgrounds: [],
  ownedIds: [],
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useFriendRoom', () => {
  it('loads a member room + day and maps them to app models', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      urls.push(url);
      if (url.includes('/room')) {
        return res({
          character: {
            characterId: 1,
            code: 'otter',
            animations: { idle: 'characters/otter/animations/idle.webp' },
          },
          streak: { currentCount: 5 },
          cobweb: {
            assetKey: 'items/common/decor/room-corner-cobweb.png',
            appearedAt: '2026-08-12T03:30:00Z',
            cleanable: true,
          },
          slots: [
            { slotType: 'bottomLeft', userItemId: 777, assetKey: 'items/a/bed.png' },
            { slotType: 'wallpaper', userItemId: 778, assetKey: 'items/a/wp.png' },
          ],
        });
      }
      if (url.includes('/routine-completions')) {
        return res({
          from: '2026-06-25',
          to: '2026-07-08',
          items: [
            { routineDate: '2026-07-08', routineId: 30, originRoutineId: 3, title: '아침 기상' },
            { routineDate: '2026-07-07', routineId: 30, originRoutineId: 3, title: '아침 기상' },
            { routineDate: '2026-07-07', routineId: 31, originRoutineId: 8, title: '독서 30분' },
          ],
        });
      }
      return res({
        date: '2026-07-08',
        routines: [{ id: 30, originRoutineId: 3, title: '아침 기상', completed: true }],
        todos: [{ id: 9, title: '장보기', status: 'PENDING' }],
      });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useFriendRoom());
    await act(async () => {
      await result.current.load(11, 42, CATALOGUE);
    });
    await waitFor(() => expect(result.current.friendRoom.loading).toBe(false));

    expect(urls.some((u) => u.endsWith('/houses/11/members/42/room'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/houses/11/members/42/day'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/houses/11/members/42/routine-completions'))).toBe(true);

    const { friendRoom } = result.current;
    expect(friendRoom.characterId).toBe('otter');
    // A matched code carries its CDN animation keys to the room (#263).
    expect(friendRoom.characterAnimations).toEqual({
      idle: 'characters/otter/animations/idle.webp',
    });
    expect(friendRoom.streakDays).toBe(5);
    expect(friendRoom.cobweb?.cleanable).toBe(true);
    expect(friendRoom.placement).toEqual({
      placedFurnitureIds: ['2'],
      wallpaperId: '9',
      floorId: null,
      backgroundId: null,
      // 슬롯 방(SLOT_V1)은 자유 배치 없음 (#327).
      placements: null,
    });
    expect(friendRoom.routines).toHaveLength(2);
    expect(friendRoom.routines[0]).toMatchObject({ id: '3', completed: true });
    expect(friendRoom.routines[1]).toMatchObject({ id: 'todo-9', completed: false });
    // Completion history grouped per day (server order preserved, date desc).
    expect(friendRoom.recentActivity).toEqual([
      { date: '2026-07-08', label: '7월 8일', titles: ['아침 기상'] },
      { date: '2026-07-07', label: '7월 7일', titles: ['아침 기상', '독서 30분'] },
    ]);
  });

  it('cleans the loaded member cobweb and removes it after the server succeeds', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      urls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/room/cobweb/clean')) {
        return res({ rewardCurrencyType: 'COIN', rewardAmount: 3, balance: 103 });
      }
      if (url.includes('/room')) {
        return res({
          cobweb: {
            assetKey: 'items/common/decor/room-corner-cobweb.png',
            appearedAt: '2026-08-12T03:30:00Z',
            cleanable: true,
          },
        });
      }
      return res({});
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useFriendRoom());
    await act(async () => {
      await result.current.load(11, 42, CATALOGUE);
    });
    await act(async () => {
      const reward = await result.current.cleanCobweb();
      expect(reward?.balance).toBe(103);
    });

    expect(urls.some((url) => url.includes('POST') && url.endsWith('/houses/11/members/42/room/cobweb/clean'))).toBe(true); // prettier-ignore
    expect(result.current.friendRoom.cobweb).toBeUndefined();
  });

  it('drops the animations when the character code has no app-side match', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/room')) {
        return res({
          // A species the app doesn't know: the room falls back to the default
          // character, so the server animations must not ride along.
          character: {
            characterId: 9,
            code: 'dragon',
            animations: { idle: 'characters/dragon/animations/idle.webp' },
          },
        });
      }
      return res({});
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useFriendRoom());
    await act(async () => {
      await result.current.load(11, 42, CATALOGUE);
    });
    await waitFor(() => expect(result.current.friendRoom.loading).toBe(false));

    expect(result.current.friendRoom.characterId).toBeUndefined();
    expect(result.current.friendRoom.characterAnimations).toBeUndefined();
  });

  it('hides the activity section (undefined) when the history endpoint fails', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/routine-completions')) {
        return { ok: false, status: 500, text: async () => '{}' };
      }
      return res({});
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useFriendRoom());
    await act(async () => {
      await result.current.load(11, 42, CATALOGUE);
    });
    await waitFor(() => expect(result.current.friendRoom.loading).toBe(false));

    expect(result.current.friendRoom.recentActivity).toBeUndefined();
  });

  // 방문 실패는 빈 방으로 위장하지 않는다 (#549).
  it('방·루틴·기록 3요청 전멸 시 error, 재시도 성공 시 해제된다 (#549)', async () => {
    let broken = true;
    global.fetch = jest.fn(async (url: string) => {
      if (broken) return { ok: false, status: 500, text: async () => '{}' };
      if (url.includes('/room')) return res({ streak: { currentCount: 2 } });
      return res({});
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useFriendRoom());
    await act(async () => {
      await result.current.load(11, 42, CATALOGUE);
    });
    expect(result.current.friendRoom.error).toBe(true);
    expect(result.current.friendRoom.loading).toBe(false);

    broken = false;
    await act(async () => {
      await result.current.load(11, 42, CATALOGUE);
    });
    expect(result.current.friendRoom.error).toBeFalsy();
    expect(result.current.friendRoom.streakDays).toBe(2);
  });

  it('resets to the empty state when the ids are missing (demo houses)', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    const { result } = await renderHook(() => useFriendRoom());
    await act(async () => {
      await result.current.load(undefined, undefined, CATALOGUE);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.friendRoom).toMatchObject({
      placement: null,
      routines: [],
      loading: false,
    });
  });
});
