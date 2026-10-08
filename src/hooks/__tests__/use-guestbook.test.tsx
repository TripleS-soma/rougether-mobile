import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useGuestbook } from '@/hooks/use-guestbook';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

// 토스트 스파이 — 훅은 no-op 기본 컨텍스트로도 돌지만 발화 여부를 단언한다.
const mockShowToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ show: mockShowToast }),
}));

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  mockShowToast.mockClear();
});

const note = (id: number, content: string, authorNickname = '친구') => ({
  guestbookId: id,
  authorId: 2,
  authorNickname,
  content,
  createdAt: '2026-07-01T09:00:00Z',
});

/** 첫 페이지(커서 없음) → 2번째 페이지(cursor=1)로 이어지는 방명록 서버. */
function mockGuestbookServer() {
  const calls: { url: string; method: string }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    if (method === 'POST') {
      return res({
        guestbookId: 9,
        authorId: 4,
        content: '내 글',
        createdAt: '2026-07-02T09:00:00Z',
      });
    }
    if (url.includes('cursor=1')) return res({ items: [note(1, '옛 글')], hasNext: false });
    return res({ items: [note(2, '새 글')], hasNext: true, nextCursor: 1 });
  }) as unknown as typeof fetch;
  return calls;
}

describe('useGuestbook', () => {
  it('loads the first page for a room', async () => {
    global.fetch = jest.fn(async () =>
      res({
        items: [{ guestbookId: 1, authorId: 2, authorNickname: '친구', content: '안녕', createdAt: '2026-07-01T09:00:00Z' }], // prettier-ignore
        hasNext: false,
      }),
    ) as unknown as typeof fetch;

    const { result } = await renderHook(() => useGuestbook(), { wrapper: queryWrapper() });
    await act(async () => {
      await result.current.load(7, 11);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  // 로드 실패를 '방명록 없음'으로 위장하지 않고 토스트로 알린다 (#549).
  it('초기 로드 실패 시 실패 토스트를 띄운다 (#549)', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => '{}',
    })) as unknown as typeof fetch;

    const { result } = await renderHook(() => useGuestbook(), { wrapper: queryWrapper() });
    await act(async () => {
      await result.current.load(7, 11);
    });

    expect(result.current.entries).toEqual([]);
    expect(mockShowToast).toHaveBeenCalledWith('방명록을 불러오지 못했어요', 'error');
  });

  it('방 정보가 없으면(데모) 요청하지 않고 비운다', async () => {
    const calls = mockGuestbookServer();
    const { result } = await renderHook(() => useGuestbook(), { wrapper: queryWrapper() });
    await act(async () => {
      await result.current.load(undefined, 11);
    });
    expect(result.current.entries).toBeUndefined();
    expect(result.current.hasNext).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('더보기는 커서로 다음 페이지를 이어 붙인다', async () => {
    const calls = mockGuestbookServer();
    const { result } = await renderHook(() => useGuestbook(), { wrapper: queryWrapper() });
    await act(async () => {
      await result.current.load(7, 11);
    });
    expect(result.current.hasNext).toBe(true);
    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() =>
      expect(result.current.entries?.map((e) => e.content)).toEqual(['새 글', '옛 글']),
    );
    expect(result.current.hasNext).toBe(false);
    expect(calls.filter((c) => c.url.includes('cursor=1'))).toHaveLength(1);
  });

  it('쓰면 내 글을 맨 위에 붙이고 작성자는 "나"로 보인다', async () => {
    mockGuestbookServer();
    const { result } = await renderHook(() => useGuestbook(), { wrapper: queryWrapper() });
    await act(async () => {
      await result.current.load(7, 11);
    });
    await act(async () => {
      await result.current.write('내 글');
    });
    await waitFor(() =>
      expect(result.current.entries?.[0]).toMatchObject({ content: '내 글', author: '나' }),
    );
    expect(result.current.entries).toHaveLength(2);
    expect(mockShowToast).toHaveBeenCalledWith('방명록을 남겼어요', 'success');
  });

  it('다른 방으로 옮기면 그 방의 첫 페이지로 갈아끼운다', async () => {
    const calls = mockGuestbookServer();
    const { result } = await renderHook(() => useGuestbook(), { wrapper: queryWrapper() });
    await act(async () => {
      await result.current.load(7, 11);
    });
    await act(async () => {
      await result.current.load(8, 11);
    });
    expect(calls.filter((c) => c.url.includes('/rooms/8/guestbooks'))).toHaveLength(1);
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
  });
});
