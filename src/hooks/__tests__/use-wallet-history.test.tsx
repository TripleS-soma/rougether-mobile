import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useWalletHistory } from '@/hooks/use-wallet-history';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const PAGE_SIZE = 20;

function history(page: number, total: number) {
  const start = page * PAGE_SIZE;
  const count = Math.max(0, Math.min(PAGE_SIZE, total - start));
  return {
    items: Array.from({ length: count }, (_, i) => ({
      id: start + i + 1,
      currencyType: 'COIN',
      amount: 10,
      reason: 'ROUTINE_COMPLETE',
      balanceAfter: 100,
      createdAt: '2026-09-01T00:00:00',
    })),
    page,
    size: PAGE_SIZE,
    totalElements: total,
  };
}

function pageOf(url: string) {
  return Number(new URL(url, 'http://x').searchParams.get('page'));
}

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function mockFetch(handler: (url: string) => ReturnType<typeof res>) {
  const fn = jest.fn(async (url: string) => handler(url));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('useWalletHistory', () => {
  it('마운트만으로는 받지 않고, load()로 1페이지를 받는다', async () => {
    const fetchMock = mockFetch((url) => res(history(pageOf(url), 5)));
    const { result } = await renderHook(() => useWalletHistory(), { wrapper: queryWrapper() });

    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(5));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.entries[0]).toMatchObject({ id: 1, currency: 'coin', amount: 10 });
  });

  it('총량이 한 페이지를 넘으면 hasNext, loadMore가 다음 페이지를 이어붙인다', async () => {
    const fetchMock = mockFetch((url) => res(history(pageOf(url), 45)));
    const { result } = await renderHook(() => useWalletHistory(), { wrapper: queryWrapper() });

    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(20));
    expect(result.current.hasNext).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(40));
    expect(result.current.entries[20].id).toBe(21);
    expect(result.current.hasNext).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(45));
    expect(result.current.hasNext).toBe(false);
    expect(fetchMock.mock.calls.map((c) => pageOf(String(c[0])))).toEqual([0, 1, 2]);
  });

  it('load()는 페이지를 이어붙인 뒤에도 1페이지부터 다시 읽는다', async () => {
    let total = 45;
    const fetchMock = mockFetch((url) => res(history(pageOf(url), total)));
    const { result } = await renderHook(() => useWalletHistory(), { wrapper: queryWrapper() });

    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(20));
    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(40));

    // 완료 취소로 이력이 줄었다 — 시트를 다시 열면 1페이지만 새로 받는다.
    total = 3;
    fetchMock.mockClear();
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(3));
    expect(result.current.hasNext).toBe(false);
    expect(fetchMock.mock.calls.map((c) => pageOf(String(c[0])))).toEqual([0]);
  });

  it('첫 페이지 실패는 error, 다시 load()해 성공하면 풀린다', async () => {
    let broken = true;
    mockFetch((url) => (broken ? res({}, 500) : res(history(pageOf(url), 2))));
    const { result } = await renderHook(() => useWalletHistory(), { wrapper: queryWrapper() });

    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(false);

    broken = false;
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(result.current.error).toBe(false);
  });

  it('더보기 실패는 기존 목록을 유지한 채 error를 올리지 않는다', async () => {
    mockFetch((url) => (pageOf(url) === 0 ? res(history(0, 45)) : res({}, 500)));
    const { result } = await renderHook(() => useWalletHistory(), { wrapper: queryWrapper() });

    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(20));

    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(20);
    expect(result.current.error).toBe(false);
    expect(result.current.hasNext).toBe(true);
  });

  it('돌려주는 콜백은 재렌더 사이에 참조가 고정된다 (#539)', async () => {
    mockFetch((url) => res(history(pageOf(url), 45)));
    const { result } = await renderHook(() => useWalletHistory(), { wrapper: queryWrapper() });
    const first = result.current;
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(20));
    expect(result.current.load).toBe(first.load);
    expect(result.current.loadMore).toBe(first.loadMore);
  });
});
