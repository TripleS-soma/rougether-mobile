/**
 * 공동미션 조각(use-house-missions.ts) — 기여 추적과 완료 응답의 자동 기여.
 * houses·reloadHouse를 useHouses에서 받으므로 그 훅으로 렌더해 단언한다.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useHouses } from '@/hooks/use-houses';
import { jsonRes as res } from '@/test-utils/fetch';

const mockToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ show: mockToast }),
}));

const realFetch = global.fetch;
beforeEach(() => mockToast.mockClear());
afterEach(() => {
  global.fetch = realFetch;
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

describe('useHouses — 완료 응답의 서버 자동 기여 반영 (#578)', () => {
  it('applyMissionContribution이 기여 마킹 후 해당 집 번들만 재동기화한다', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/me/houses')) return res({ items: [{ houseId: 6, name: '집' }] });
      if (url.includes('/houses/6/missions'))
        return res({
          items: [
            { missionId: 11, title: '다같이 스트레칭', missionType: 'WEEKLY_MEMBER_COUNT', targetValue: 10, currentValue: 4, status: 'ACTIVE' }, // prettier-ignore
          ],
        });
      if (url.includes('/houses/6/members')) return res({ items: [] });
      if (url.includes('/houses/6')) return res({ houseId: 6, name: '집', myRole: 'OWNER' });
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useHouses());
    await waitFor(() => expect(result.current.houses.length).toBe(1));

    calls.length = 0;
    await act(async () => {
      result.current.applyMissionContribution({
        missionId: 11,
        myContribution: 1,
        currentValue: 5,
        achieved: false,
      });
    });

    // 기여 마킹 — 미션 카드가 즉시 '기여함'으로 읽힌다.
    expect([...result.current.contributedMissionIds]).toEqual([11]);
    // 미션 currentValue 갱신은 그 집 번들 재조회로 — 전체(/me/houses)는 안 긁는다.
    await waitFor(() => expect(calls.some((c) => c.includes('/houses/6/missions'))).toBe(true));
    expect(calls.some((c) => c.endsWith('/me/houses'))).toBe(false);
    // 클라가 contribute 엔드포인트를 직접 치지 않는다.
    expect(calls.some((c) => c.includes('/contribute'))).toBe(false);
  });
});
