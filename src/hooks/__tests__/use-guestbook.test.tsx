import { act, renderHook } from '@testing-library/react-native';

import { useGuestbook } from '@/hooks/use-guestbook';

// 토스트 스파이 — 훅은 no-op 기본 컨텍스트로도 돌지만 발화 여부를 단언한다.
const mockShowToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ show: mockShowToast }),
}));

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

describe('useGuestbook', () => {
  it('loads the first page for a room', async () => {
    global.fetch = jest.fn(async () =>
      res({
        items: [{ guestbookId: 1, authorId: 2, authorNickname: '친구', content: '안녕', createdAt: '2026-07-01T09:00:00Z' }], // prettier-ignore
        hasNext: false,
      }),
    ) as unknown as typeof fetch;

    const { result } = await renderHook(() => useGuestbook());
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

    const { result } = await renderHook(() => useGuestbook());
    await act(async () => {
      await result.current.load(7, 11);
    });

    expect(result.current.entries).toEqual([]);
    expect(mockShowToast).toHaveBeenCalledWith('방명록을 불러오지 못했어요', 'error');
  });
});
