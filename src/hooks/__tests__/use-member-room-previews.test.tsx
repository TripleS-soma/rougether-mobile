import { act, renderHook } from '@testing-library/react-native';

import type { ShopCatalogue } from '@/api/adapters';
import {
  characterIdForMember,
  useMemberRoomPreviews,
  withMyCharacter,
} from '@/hooks/use-member-room-previews';
import type { House, MemberRoomPreview } from '@/components/screens/house-screen';

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

describe('useMemberRoomPreviews', () => {
  it('maps each member room and drops the ones that fail', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.endsWith('/members/42/room')) {
        return res({
          character: { characterId: 1, code: 'otter' },
          slots: [
            { slotType: 'bottomLeft', userItemId: 777, assetKey: 'items/a/bed.png' },
            { slotType: 'wallpaper', userItemId: 778, assetKey: 'items/a/wp.png' },
          ],
        });
      }
      return { ok: false, status: 500, text: async () => '{}' };
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMemberRoomPreviews());
    await act(async () => {
      await result.current.load(11, [42, 43], CATALOGUE);
    });

    expect(Object.keys(result.current.previews)).toEqual(['42']);
    expect(result.current.previews[42]).toMatchObject({
      placedFurnitureIds: ['2'],
      wallpaperId: '9',
      characterId: 'otter',
    });
  });

  it('does not poison the cache while the catalogue is still loading', async () => {
    global.fetch = jest.fn(async () => res({ slots: [] })) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMemberRoomPreviews());
    await act(async () => {
      // Pre-load catalogue (EMPTY): must neither fetch nor mark the house done.
      await result.current.load(11, [42], CATALOGUE, false);
    });
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.load(11, [42], CATALOGUE, true);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.previews[42]).toBeTruthy();
  });

  it('loads a house once and refetches only when the house changes', async () => {
    global.fetch = jest.fn(async () => res({ slots: [] })) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMemberRoomPreviews());
    await act(async () => {
      await result.current.load(11, [42], CATALOGUE);
      await result.current.load(11, [42], CATALOGUE); // same house — cached
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.load(12, [55], CATALOGUE); // house switch — reload
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('withMyCharacter', () => {
  const HOUSES: House[] = [
    {
      houseId: 11,
      name: '집',
      floors: [
        {
          level: '1층',
          rooms: [
            { name: '나', color: '#EEE', isMine: true, membershipId: 43 },
            { name: '친구', color: '#EEE', membershipId: 42 },
          ],
        },
      ],
    },
  ];
  const previews: Record<number, MemberRoomPreview> = {
    42: { placedFurnitureIds: [], characterId: 'otter' },
    43: { placedFurnitureIds: [], characterId: 'otter' },
  };

  it('re-wears only my seats with the worn character (#282)', () => {
    const next = withMyCharacter(previews, HOUSES, 'tiger');
    expect(next[43].characterId).toBe('tiger'); // 내 좌석 = 착용 캐릭터
    expect(next[42].characterId).toBe('otter'); // 친구 좌석은 그대로
  });

  it('changes nothing before the worn character loads, or when already current', () => {
    // 서버 확정값이 없으면 손대지 않는다 (다른 기기에서 바꾼 경우 안전).
    expect(withMyCharacter(previews, HOUSES, undefined)).toBe(previews);
    // 이미 일치하면 같은 참조를 돌려줘 불필요한 리렌더가 없다.
    expect(withMyCharacter(previews, HOUSES, 'otter')).toBe(previews);
  });
});

describe('characterIdForMember (#342, #753에서 공용 헬퍼로)', () => {
  const previews = {
    42: {
      placedFurnitureIds: [],
      wallpaperId: 'cream',
      floorId: null,
      backgroundId: null,
      characterId: 'otter' as const,
    },
  };

  it('프리뷰가 있으면 그 멤버의 캐릭터, 없으면 내 좌석만 내 캐릭터', () => {
    const friend = { name: '친구', color: '#F5E1D8', membershipId: 42 };
    const me = { name: '나', color: '#E8E0D0', isMine: true, membershipId: 43 };
    const stranger = { name: '남', color: '#EEE', membershipId: 44 };
    expect(characterIdForMember(friend, previews, 'tiger')).toBe('otter');
    expect(characterIdForMember(me, previews, 'tiger')).toBe('tiger');
    // 프리뷰 없는 남의 좌석은 기본 캐릭터.
    expect(characterIdForMember(stranger, previews, 'tiger')).not.toBe('tiger');
  });

  it('membershipId 없는 좌석은 프리뷰 조회 없이 폴백', () => {
    expect(characterIdForMember({ name: '나', color: '#EEE', isMine: true }, previews, 'cat')).toBe(
      'cat',
    );
  });
});

describe('useMemberRoomPreviews — clearCobweb (#831)', () => {
  it('해당 멤버 타일의 거미줄만 걷는다', async () => {
    global.fetch = jest.fn(async (url: string) => {
      const membershipId = Number(url.match(/members\/(\d+)/)?.[1]);
      return res({
        slots: [],
        cobweb: { assetKey: `items/cobweb-${membershipId}.png`, cleanable: true },
      });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMemberRoomPreviews());
    await act(async () => {
      await result.current.load(1, [2, 3], CATALOGUE);
    });
    expect(result.current.previews[2]?.cobweb).toBeTruthy();
    expect(result.current.previews[3]?.cobweb).toBeTruthy();

    await act(async () => result.current.clearCobweb(2));

    expect(result.current.previews[2]?.cobweb).toBeNull();
    // 다른 멤버는 그대로 — 친구 방 하나 치웠다고 집 전체가 깨끗해지면 안 된다.
    expect(result.current.previews[3]?.cobweb).toBeTruthy();
  });
});
