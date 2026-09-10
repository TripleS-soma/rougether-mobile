import { act, renderHook } from '@testing-library/react-native';

import { useInvites } from '@/hooks/use-invites';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const mockToastShow = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ show: mockToastShow }),
}));

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  mockToastShow.mockClear();
  mockTrack.mockClear();
});

const fail = (status: number, code?: string) => ({
  ok: false,
  status,
  text: async () => (code ? JSON.stringify({ code }) : '{}'),
});

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fn = jest.fn(async (url: string, init?: RequestInit) => handler(url, init));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('useInvites.preview (#1007)', () => {
  it('정규화한 코드로 미리보기를 받아 화면용 모양으로 돌려준다', async () => {
    const fetchMock = mockFetch(() =>
      res({ inviterNickname: '소마', inviteeRewardCoin: 50, alreadyRedeemed: false }),
    );
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });

    let preview: unknown;
    await act(async () => {
      preview = await result.current.preview(' abcd2345 ');
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/invites/by-code/ABCD2345');
    expect(preview).toEqual({
      code: 'ABCD2345',
      inviterNickname: '소마',
      rewardCoin: 50,
      alreadyRedeemed: false,
    });
    // 미리보기는 사용이 아니다 — redeem 호출도 계측도 없다.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/invites/redeem'))).toBe(
      false,
    );
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('닉네임이 없어도 null로 채운다', async () => {
    mockFetch(() => res({ inviteeRewardCoin: 50, alreadyRedeemed: true }));
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });
    let preview: unknown;
    await act(async () => {
      preview = await result.current.preview('ABCD2345');
    });
    expect(preview).toMatchObject({ inviterNickname: null, alreadyRedeemed: true });
  });

  it.each([
    [fail(404, 'INVITE_CODE_NOT_FOUND'), '초대코드를 찾을 수 없어요'],
    [fail(400, 'INVITE_SELF_NOT_ALLOWED'), '내 초대코드는 사용할 수 없어요'],
    [fail(403, 'INVITE_BOT_NOT_ALLOWED'), '이 초대코드는 사용할 수 없어요'],
    [fail(500), '초대코드를 확인하지 못했어요'],
  ])('실패는 안내 후 null (%#)', async (response, message) => {
    mockFetch(() => response);
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });
    let preview: unknown = 'unset';
    await act(async () => {
      preview = await result.current.preview('ABCD2345');
    });
    expect(preview).toBeNull();
    expect(mockToastShow).toHaveBeenCalledWith(message, 'error');
  });

  it('빈 코드는 요청하지 않는다', async () => {
    const fetchMock = mockFetch(() => res({}));
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });
    await act(async () => {
      await result.current.preview('   ');
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('사용 계측은 코드가 어디서 왔는지(via)를 남긴다', async () => {
    mockFetch(() => res({ rewardCoin: 50 }));
    const { result } = await renderHook(() => useInvites(), { wrapper: queryWrapper() });
    await act(async () => {
      await result.current.redeem('ABCD2345', 'paste');
    });
    expect(mockTrack).toHaveBeenCalledWith('invite_redeem', { via: 'paste' });
  });
});
