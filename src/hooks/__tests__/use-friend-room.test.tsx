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
    // A matched code carries its CDN keys to the room as ordered frames
    // (#263) — friend rooms have no poses[], so the legacy set is flattened.
    expect(friendRoom.characterFrames).toEqual(['characters/otter/animations/idle.webp']);
    expect(friendRoom.streakDays).toBe(5);
    // 표면은 슬롯에서, 가구는 placements에서 (#925) — 응답의 positioned 슬롯은 무시된다.
    expect(friendRoom.placement).toEqual({
      wallpaperId: '9',
      floorId: null,
      backgroundId: null,
      placements: [],
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

  it('drops the frames when the character code has no app-side match', async () => {
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
    expect(result.current.friendRoom.characterFrames).toBeUndefined();
  });

  it('내 방과 같은 그림을 쓴다 — 마스터 poses가 응답 animations를 이긴다 (#968)', async () => {
    // 친구 방 응답에는 poses[]가 없어 예전엔 무조건 레거시 animations로 떨어졌고,
    // 내 방(마스터 poses)과 **같은 캐릭터가 다른 그림**으로 나왔다.
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/room')) {
        return res({
          character: {
            characterId: 7,
            code: 'cat',
            animations: {
              idle: 'characters/cat/animations/idle.webp',
              poseCycle: 'characters/cat/animations/pose-cycle.webp',
            },
          },
        });
      }
      return res({});
    }) as unknown as typeof fetch;

    const masterFrames = { cat: ['characters/pose-a.webp', 'characters/pose-b.webp'] };
    const { result } = await renderHook(() => useFriendRoom());
    await act(async () => {
      await result.current.load(11, 42, CATALOGUE, masterFrames);
    });
    await waitFor(() => expect(result.current.friendRoom.loading).toBe(false));

    expect(result.current.friendRoom.characterFrames).toEqual([
      'characters/pose-a.webp',
      'characters/pose-b.webp',
    ]);
  });

  it('마스터에 그 캐릭터가 없으면 응답 animations로 떨어진다 (#968)', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/room')) {
        return res({
          character: {
            characterId: 7,
            code: 'cat',
            animations: { idle: 'characters/cat/animations/idle.webp' },
          },
        });
      }
      return res({});
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useFriendRoom());
    await act(async () => {
      // 마스터를 못 받은 상태(빈 맵) — 폴백이 살아 있어야 한다.
      await result.current.load(11, 42, CATALOGUE, {});
    });
    await waitFor(() => expect(result.current.friendRoom.loading).toBe(false));

    expect(result.current.friendRoom.characterFrames).toEqual([
      'characters/cat/animations/idle.webp',
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

describe('useFriendRoom — 구성원 방 거미줄 청소 (#831)', () => {
  const setUp = (clean: { ok: boolean; status: number; body: unknown }) => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/cobweb/clean')) {
        return { ok: clean.ok, status: clean.status, text: async () => JSON.stringify(clean.body) };
      }
      if (url.includes('/room'))
        return res({ slots: [], cobweb: { assetKey: 'items/cobweb.png', cleanable: true } });
      return res({ items: [] });
    }) as unknown as typeof fetch;
  };

  const loaded = async () => {
    const { result } = await renderHook(() => useFriendRoom());
    await act(async () => {
      await result.current.load(1, 2, CATALOGUE);
    });
    await waitFor(() => expect(result.current.friendRoom.cobweb).not.toBeNull());
    return result;
  };

  it('청소 성공 → 받은 코인 수를 돌려주고 거미줄을 걷는다', async () => {
    setUp({ ok: true, status: 200, body: { rewardCurrencyType: 'COIN', rewardAmount: 3 } });
    const result = await loaded();

    let reward: number | null = null;
    await act(async () => {
      reward = await result.current.cleanCobweb(1, 2);
    });

    expect(reward).toBe(3);
    expect(result.current.friendRoom.cobweb).toBeNull();
  });

  /** 보상은 최초 1인에게만 — null이어야 화면이 코인 연출을 안 쏜다 (#830과 같은 계약). */
  it('409(이미 청소됨) → null, 거미줄만 걷는다', async () => {
    setUp({ ok: false, status: 409, body: { code: 'ROOM_COBWEB_NOT_ACTIVE' } });
    const result = await loaded();

    let reward: number | null = 999;
    await act(async () => {
      reward = await result.current.cleanCobweb(1, 2);
    });

    expect(reward).toBeNull();
    expect(result.current.friendRoom.cobweb).toBeNull();
  });

  it('그 밖의 실패는 throw — 호출부가 실패 문구를 띄운다', async () => {
    setUp({ ok: false, status: 500, body: {} });
    const result = await loaded();

    await expect(result.current.cleanCobweb(1, 2)).rejects.toBeTruthy();
    expect(result.current.friendRoom.cobweb).not.toBeNull();
  });
});
