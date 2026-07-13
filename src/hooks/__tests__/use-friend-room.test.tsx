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
          character: { characterId: 1, code: 'otter' },
          streak: { currentCount: 5 },
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
    expect(friendRoom.streakDays).toBe(5);
    expect(friendRoom.placement).toEqual({
      placedFurnitureIds: ['2'],
      wallpaperId: '9',
      floorId: null,
      backgroundId: null,
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
