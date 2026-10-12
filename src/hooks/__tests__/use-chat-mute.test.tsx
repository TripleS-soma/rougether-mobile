import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useChatMute } from '@/hooks/use-chat-mute';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function mockServer(opts: { failPut?: boolean } = {}) {
  const calls: { method: string; url: string; body?: string }[] = [];
  let muted = false;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body as string | undefined });
    if (method === 'PUT') {
      if (opts.failPut) return res({ code: 'X' }, 500);
      muted = JSON.parse(String(init?.body)).muted;
    }
    return res({ roomId: 7, muted });
  }) as unknown as typeof fetch;
  return calls;
}

describe('useChatMute (서버 #435)', () => {
  it('방 id가 생기면 상태를 받고, 토글하면 PUT { muted } 후 반영된다', async () => {
    const calls = mockServer();
    const { result } = await renderHook(() => useChatMute({ roomId: 7 }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.muted).toBe(false);
    await act(async () => {
      await result.current.toggle();
    });
    await waitFor(() => expect(result.current.muted).toBe(true));
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toContain('/chat/rooms/7/notification');
    expect(JSON.parse(put?.body ?? '{}')).toEqual({ muted: true });
  });

  it('바꾸기가 실패하면 되돌리고 알린다', async () => {
    mockServer({ failPut: true });
    const onError = jest.fn();
    const { result } = await renderHook(() => useChatMute({ roomId: 7, onError }), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.toggle();
    });
    await waitFor(() => expect(result.current.muted).toBe(false));
    expect(onError).toHaveBeenCalled();
  });

  it('방 id가 없으면 요청하지 않는다', async () => {
    const calls = mockServer();
    const { result } = await renderHook(() => useChatMute({ roomId: undefined }), {
      wrapper: queryWrapper(),
    });
    expect(result.current.loaded).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
