import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useHouseFeedNotification } from '@/hooks/use-house-feed-notification';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function mockServer(opts: { failPut?: boolean; missing?: boolean } = {}) {
  const calls: { method: string; url: string; body?: string }[] = [];
  let state = { houseId: 3, freePostPush: true, verificationPostPush: false };
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body as string | undefined });
    // 설정 API가 아직 없는 서버.
    if (opts.missing) return res({ code: 'NOT_FOUND' }, 404);
    if (method === 'PUT') {
      if (opts.failPut) return res({ code: 'X' }, 500);
      state = { ...state, ...JSON.parse(String(init?.body)) };
    }
    return res(state);
  }) as unknown as typeof fetch;
  return calls;
}

describe('useHouseFeedNotification (집 피드 새 글 푸시)', () => {
  it('집 id가 있으면 설정을 받는다 — 서버 기본값은 자유글 켬·인증글 끔', async () => {
    const calls = mockServer();
    const { result } = await renderHook(() => useHouseFeedNotification({ houseId: 3 }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(calls[0].url).toContain('/houses/3/feed/notification');
    expect(result.current).toMatchObject({
      freePostPush: true,
      verificationPostPush: false,
      unavailable: false,
    });
  });

  it('스위치 하나를 뒤집으면 그 필드만 PUT으로 보내고 반영한다', async () => {
    const calls = mockServer();
    const { result } = await renderHook(() => useHouseFeedNotification({ houseId: 3 }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.toggle('verificationPostPush');
    });
    await waitFor(() => expect(result.current.verificationPostPush).toBe(true));
    expect(result.current.freePostPush).toBe(true);
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toContain('/houses/3/feed/notification');
    expect(JSON.parse(put?.body ?? '{}')).toEqual({ verificationPostPush: true });
  });

  it('바꾸기가 실패하면 되돌리고 알린다', async () => {
    mockServer({ failPut: true });
    const onError = jest.fn();
    const { result } = await renderHook(() => useHouseFeedNotification({ houseId: 3, onError }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.toggle('freePostPush');
    });
    await waitFor(() => expect(result.current.freePostPush).toBe(true));
    expect(onError).toHaveBeenCalled();
  });

  it('서버에 설정 API가 없으면(404) unavailable — 기본값을 그리되 바꾸지 않는다', async () => {
    const calls = mockServer({ missing: true });
    const { result } = await renderHook(() => useHouseFeedNotification({ houseId: 3 }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current).toMatchObject({
      loaded: false,
      freePostPush: true,
      verificationPostPush: false,
    });
    // 4xx는 다시 묻지 않는다.
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    await act(async () => {
      await result.current.toggle('freePostPush');
    });
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('집 id가 없거나 꺼져 있으면 요청하지 않는다', async () => {
    const calls = mockServer();
    const wrapper = queryWrapper();
    await renderHook(() => useHouseFeedNotification({ houseId: undefined }), { wrapper });
    await renderHook(() => useHouseFeedNotification({ houseId: 3, enabled: false }), { wrapper });
    expect(calls).toHaveLength(0);
  });
});
