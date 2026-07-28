import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useHouses } from '@/hooks/use-houses';

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

describe('useHouses — 집 탐색 filter', () => {
  it('hides houses the user already belongs to from the browse list', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/me/houses')) return res({ items: [{ houseId: 1, name: '내집' }] });
      if (url.includes('/houses/1/members')) return res({ items: [] });
      if (url.includes('/houses/1/missions')) return res({ items: [] });
      if (url.includes('/houses/1')) return res({ houseId: 1, name: '내집', myRole: 'OWNER' });
      if (url.endsWith('/me')) return res({ userId: 5, nickname: '나' });
      if (url.includes('/houses?')) {
        return res({
          items: [
            { houseId: 1, name: '내집', currentMemberCount: 1, maxMembers: 4 },
            {
              houseId: 2,
              name: '남의집',
              currentMemberCount: 2,
              maxMembers: 4,
              myJoinRequestStatus: 'PENDING',
            },
          ],
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.searchLoading).toBe(false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // My own house (id 1) is excluded; only the joinable one remains.
    expect(result.current.searchHouses.map((h) => h.name)).toEqual(['남의집']);
    expect(result.current.searchHouses[0].joinRequestStatus).toBe('PENDING');
    expect(result.current.houses.map((h) => h.title)).toEqual(['내집']);
  });
});

describe('useHouses — 기여 추적', () => {
  it('marks a mission contributed on success and on the daily-cap error', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/missions/11/contribute') && init?.method === 'POST')
        return res({ missionId: 11, myContribution: 1, currentValue: 1, achieved: false });
      if (url.includes('/missions/12/contribute') && init?.method === 'POST')
        return {
          ok: false,
          status: 409,
          text: async () =>
            JSON.stringify({ code: 'HOUSE_MISSION_ALREADY_CONTRIBUTED', message: '오늘은 이미' }),
        };
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.contributeMission(7, 11);
      await result.current.contributeMission(7, 12); // 이미 기여 → 그래도 기여됨 마킹
    });
    expect([...result.current.contributedMissionIds].sort()).toEqual([11, 12]);
  });
});

describe('useHouses — 입주 신청 처리', () => {
  it('reports an already-pending browse request without joining the house', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/houses/2/join-requests') && init?.method === 'POST') {
        return {
          ok: false,
          status: 409,
          text: async () =>
            JSON.stringify({
              code: 'HOUSE_JOIN_REQUEST_ALREADY_PENDING',
              message: '이미 신청 중',
            }),
        };
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.joinHouse('2');
    });

    expect(succeeded).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/houses/2/join-requests'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('calls the owner accept and reject endpoints', async () => {
    global.fetch = jest.fn(async () => res({ items: [] })) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.acceptJoinRequest(7, 21);
      await result.current.rejectJoinRequest(7, 22);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/houses/7/join-requests/21/accept'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/houses/7/join-requests/22/reject'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('useHouses — 탐색 미리보기', () => {
  it('loads public house detail and maps its missions', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/houses/7/preview')) {
        return res({
          houseId: 7,
          name: '미리보기 집',
          currentMemberCount: 2,
          maxMembers: 4,
          level: 1,
          missions: [
            {
              missionId: 91,
              title: '다같이 10번',
              missionType: 'WEEKLY_MEMBER_COUNT',
              currentValue: 3,
              targetValue: 10,
              status: 'ACTIVE',
            },
          ],
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let preview = null;
    await act(async () => {
      preview = await result.current.previewHouse('7');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/houses/7/preview'),
      expect.any(Object),
    );
    expect(preview).toMatchObject({
      houseId: 7,
      name: '미리보기 집',
      missions: [{ id: 91, current: 3, target: 10 }],
    });
  });
});
