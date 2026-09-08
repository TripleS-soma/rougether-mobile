import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useInvites } from '@/hooks/use-invites';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const mockToastShow = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ show: mockToastShow }),
}));

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

const MY_INVITE = {
  code: 'ABCD12',
  rewardedCount: 2,
  inviterRewardCoin: 100,
  inviteeRewardCoin: 50,
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  mockToastShow.mockClear();
  mockTrack.mockClear();
});

function mockFetch(handler: (url: string, init?: RequestInit) => ReturnType<typeof res>) {
  const fn = jest.fn(async (url: string, init?: RequestInit) => handler(url, init));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('useInvites', () => {
  it('마운트만으로는 받지 않고, load()로 내 초대 정보를 받는다', async () => {
    const fetchMock = mockFetch(() => res(MY_INVITE));
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });

    expect(result.current.info).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.info?.code).toBe('ABCD12'));
    expect(result.current.loading).toBe(false);
    expect(result.current.loadError).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/invites/me');
  });

  it('로드 실패는 loadError, 다시 load()해 성공하면 풀린다', async () => {
    let broken = true;
    mockFetch(() => (broken ? res({}, 500) : res(MY_INVITE)));
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });

    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.info).toBeNull();

    broken = false;
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.loadError).toBe(false));
    await waitFor(() => expect(result.current.info?.code).toBe('ABCD12'));
  });

  it('코드 사용 성공 — 보상 코인을 돌려주고 invite_redeem을 계측하며 내 정보를 다시 받는다', async () => {
    const calls: string[] = [];
    mockFetch((url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      return url.includes('/invites/redeem')
        ? res({ rewardCoin: 50, coinBalance: 350 })
        : res(MY_INVITE);
    });
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.info).not.toBeNull());

    let outcome: { rewardCoin: number } | null = null;
    await act(async () => {
      outcome = await result.current.redeem('  friend1 ');
    });
    expect(outcome).toEqual({ rewardCoin: 50 });
    expect(mockTrack).toHaveBeenCalledWith('invite_redeem');
    expect(mockToastShow).not.toHaveBeenCalled();

    const redeemCall = calls.find((c) => c.includes('/invites/redeem'));
    expect(redeemCall).toMatch(/^POST /);
    // 성공하면 보상 현황이 stale — 다음 load()가 새로 받는다.
    const before = calls.filter((c) => c.includes('/invites/me')).length;
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() =>
      expect(calls.filter((c) => c.includes('/invites/me')).length).toBeGreaterThan(before),
    );
  });

  it.each([
    [{ code: 'INVITE_ALREADY_REDEEMED' }, 409, '초대코드는 한 번만 사용할 수 있어요'],
    [{ code: 'INVITE_SELF_NOT_ALLOWED' }, 400, '내 초대코드는 사용할 수 없어요'],
    [{}, 404, '초대코드를 찾을 수 없어요'],
    [{}, 500, '초대코드 사용에 실패했어요'],
  ])('코드 사용 실패 %j/%s → 토스트 "%s" 후 null', async (body, status, message) => {
    mockFetch((url) => (url.includes('/invites/redeem') ? res(body, status) : res(MY_INVITE)));
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });

    let outcome: { rewardCoin: number } | null = { rewardCoin: -1 };
    await act(async () => {
      outcome = await result.current.redeem('nope');
    });
    expect(outcome).toBeNull();
    expect(mockToastShow).toHaveBeenCalledWith(message, 'error');
    expect(mockTrack).not.toHaveBeenCalledWith('invite_redeem');
  });

  it('돌려주는 콜백은 재렌더 사이에 참조가 고정된다 (#539)', async () => {
    mockFetch(() => res(MY_INVITE));
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });
    const first = result.current;
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.info).not.toBeNull());
    expect(result.current.load).toBe(first.load);
    expect(result.current.redeem).toBe(first.redeem);
  });
});
