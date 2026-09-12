import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useAttendance } from '@/hooks/use-attendance';
import { jsonRes as res } from '@/test-utils/fetch';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

const STATUS = {
  eventId: 7,
  code: 'ATTENDANCE_10D_2026',
  title: '10일 연속 출석',
  startsOn: '2026-08-16',
  endsOn: '2026-09-14',
  targetDays: 10,
  currentStreak: 3,
  checkedInToday: true,
  completed: false,
  checkInDates: ['2026-08-15', '2026-08-16', '2026-08-17'],
  dailyRewards: [{ day: 1, coinAmount: 30, furnitureReward: false, claimed: true }],
  reward: null,
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('useAttendance', () => {
  it('진행 중인 이벤트를 불러온다', async () => {
    global.fetch = jest.fn(async () =>
      res({ ...STATUS, checkedInToday: false }),
    ) as unknown as typeof global.fetch;
    const { result } = await renderHook(() => useAttendance(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.status?.eventId).toBe(7);
  });

  /**
   * 이벤트가 없는 게 정상 상태다 — 404를 에러로 다루면 진입점이 사라지는
   * 대신 에러 상태가 남는다. status=null로 접혀야 헤더 아이콘이 숨는다.
   */
  it('404 ATTENDANCE_EVENT_NOT_FOUND는 에러가 아니라 "이벤트 없음"이다', async () => {
    global.fetch = jest.fn(async () =>
      res({ code: 'ATTENDANCE_EVENT_NOT_FOUND', message: 'no event' }, 404),
    ) as unknown as typeof global.fetch;
    const { result } = await renderHook(() => useAttendance(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.status).toBeNull();
  });

  it('네트워크가 죽어도 화면을 막지 않고 이벤트 없음으로 접는다', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof global.fetch;
    const { result } = await renderHook(() => useAttendance(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.status).toBeNull();
  });

  it('출석하면 갱신된 상태로 갈아끼우고 지갑 잔액을 알린다', async () => {
    const onCoinBalance = jest.fn();
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') {
        return res({
          newCheckIn: true,
          coinRewardAmount: 30,
          coinBalance: 190,
          rewardGrantedNow: false,
          status: { ...STATUS, currentStreak: 4 },
        });
      }
      return res({ ...STATUS, currentStreak: 3, checkedInToday: false });
    }) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useAttendance({ onCoinBalance }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    let out;
    await act(async () => {
      out = await result.current.checkIn();
    });
    expect(out).toMatchObject({ newCheckIn: true, coinRewardAmount: 30 });
    // 캐시 반영(setQueryData)은 notifyManager가 배칭한다 — 기다려서 단언한다.
    await waitFor(() => expect(result.current.status?.currentStreak).toBe(4));
    expect(onCoinBalance).toHaveBeenCalledWith(190);
  });

  /**
   * 멱등 재호출 계약 — 훅은 결과를 **그대로** 넘겨야 한다. 여기서 newCheckIn을
   * 뭉개면 시트가 받지도 않은 보상 연출을 쏜다 (거미줄 청소 #830과 같은 함정).
   */
  it('같은 날 재호출 결과(newCheckIn=false, 코인 0)를 그대로 넘긴다', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') {
        return res({
          newCheckIn: false,
          coinRewardAmount: 0,
          coinBalance: 190,
          rewardGrantedNow: false,
          status: STATUS,
        });
      }
      return res(STATUS);
    }) as unknown as typeof global.fetch;

    const { result } = await renderHook(() => useAttendance(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let out;
    await act(async () => {
      out = await result.current.checkIn();
    });
    expect(out).toMatchObject({ newCheckIn: false, coinRewardAmount: 0 });
  });

  /**
   * 200에 빈/부분 바디가 오면 예전엔 status가 truthy가 돼서 시트가
   * dailyRewards[0]에서 터졌고 **셸 전체가 같이 죽었다**. 이상한 응답은
   * "이벤트 없음"으로 접어야 한다.
   */
  it('200이어도 형태가 안 맞는 응답은 이벤트 없음으로 접는다', async () => {
    global.fetch = jest.fn(async () => res({})) as unknown as typeof global.fetch;
    const { result } = await renderHook(() => useAttendance(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.status).toBeNull();
  });

  /**
   * 종전엔 마운트 때 한 번만 받아서, 앱을 백그라운드에 두고 KST 자정을 넘기면
   * checkedInToday가 어제 값(true)으로 남았다 — 그날 첫 완료의 자동 출석(#1294)이
   * "이미 출석"으로 보고 시트를 안 띄웠다. 재조회(포커스 복귀·무효화)가 캐시를
   * 되돌려야 한다.
   */
  it('재조회하면 자정을 넘긴 checkedInToday가 서버 값으로 되돌아온다', async () => {
    let today = true;
    global.fetch = jest.fn(async () =>
      res({ ...STATUS, checkedInToday: today }),
    ) as unknown as typeof global.fetch;
    const client = createTestQueryClient();
    const { result } = await renderHook(() => useAttendance(), {
      wrapper: queryWrapper(client),
    });
    await waitFor(() => expect(result.current.status?.checkedInToday).toBe(true));

    today = false;
    await act(async () => {
      await client.invalidateQueries();
    });
    await waitFor(() => expect(result.current.status?.checkedInToday).toBe(false));
  });

  it('dailyRewards가 빠진 응답도 접는다', async () => {
    global.fetch = jest.fn(async () =>
      res({ eventId: 7, title: '10일 연속 출석' }),
    ) as unknown as typeof global.fetch;
    const { result } = await renderHook(() => useAttendance(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.status).toBeNull();
  });
});
