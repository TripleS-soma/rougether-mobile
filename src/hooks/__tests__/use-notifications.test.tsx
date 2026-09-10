import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useNotifications } from '@/hooks/use-notifications';
import { jsonRes as res } from '@/test-utils/fetch';

const PAGE_1 = {
  items: [
    { notificationId: 12, type: 'ROUTINE_REMINDER', title: '루틴 리마인드', body: '물 마시기 할 시간이에요', isRead: false, createdAt: '2026-07-12T09:00:00Z' }, // prettier-ignore
    { notificationId: 11, type: 'HOUSE_KICK', title: '집 알림', body: '내보내졌어요', isRead: true, createdAt: '2026-07-05T09:00:00Z' }, // prettier-ignore
  ],
  nextCursor: 11,
  hasNext: true,
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('useNotifications', () => {
  it('loads the first page, counts unread, and pages with the cursor', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      urls.push(url);
      if (url.includes('cursor=11')) {
        return res({
          items: [{ notificationId: 10, title: '지난 알림', body: '', isRead: true, createdAt: '2026-07-01T09:00:00Z' }], // prettier-ignore
          nextCursor: null,
          hasNext: false,
        });
      }
      return res(PAGE_1);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotifications());
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.entries?.[0]).toMatchObject({ id: 12, read: false, date: '7월 12일' });
    expect(result.current.hasNext).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(urls.some((u) => u.includes('/notifications?cursor=11'))).toBe(true);
    expect(result.current.entries).toHaveLength(3);
    expect(result.current.hasNext).toBe(false);
  });

  it('marks one read optimistically and PATCHes the server', async () => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      return res(PAGE_1);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotifications());
    await act(async () => {
      await result.current.load();
    });
    await act(async () => {
      await result.current.markRead(12);
    });

    expect(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/notifications/12/read'))).toBe(true); // prettier-ignore
    expect(result.current.unreadCount).toBe(0);
  });

  it('rolls the row back when the read PATCH fails', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'PATCH') {
        return { ok: false, status: 500, text: async () => '{}' };
      }
      return res(PAGE_1);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotifications());
    await act(async () => {
      await result.current.load();
    });
    await act(async () => {
      await result.current.markRead(12);
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(1));
  });

  // 로드 실패는 빈 상태('알림 없음')로 위장하지 않는다 (#549).
  it('첫 페이지 로드 실패 시 error, 재시도 성공 시 해제된다 (#549)', async () => {
    let broken = true;
    global.fetch = jest.fn(async () => {
      if (broken) return { ok: false, status: 500, text: async () => '{}' };
      return res(PAGE_1);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotifications());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBe(true);
    expect(result.current.entries).toEqual([]);

    broken = false;
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBe(false);
    expect(result.current.entries).toHaveLength(2);
  });

  describe('삭제 (#1137)', () => {
    const mockServer = (deleteRes: () => unknown) => {
      const calls: { url: string; method: string }[] = [];
      global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        calls.push({ url, method });
        if (method === 'DELETE') return deleteRes();
        return res(PAGE_1);
      }) as unknown as typeof fetch;
      return calls;
    };
    const loaded = async () => {
      const hook = await renderHook(() => useNotifications());
      await act(async () => {
        await hook.result.current.load();
      });
      return hook;
    };

    it('하나를 먼저 빼고 DELETE를 보낸다 — 안 읽음 배지도 줄어든다', async () => {
      const calls = mockServer(() => ({ ok: true, status: 204, text: async () => '' }));
      const { result } = await loaded();

      await act(async () => {
        await result.current.remove(12);
      });

      expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/notifications/12'))).toBe(true); // prettier-ignore
      expect(result.current.entries?.map((n) => n.id)).toEqual([11]);
      expect(result.current.unreadCount).toBe(0);
    });

    it('실패하면 원래 자리로 되돌린다', async () => {
      mockServer(() => ({ ok: false, status: 500, text: async () => '{}' }));
      const { result } = await loaded();

      await act(async () => {
        await result.current.remove(12);
      });

      await waitFor(() => expect(result.current.entries?.map((n) => n.id)).toEqual([12, 11]));
      expect(result.current.unreadCount).toBe(1);
    });

    it('404는 이미 없는 알림이라 되돌리지 않는다', async () => {
      mockServer(() => ({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ code: 'NOTIFICATION_NOT_FOUND' }),
      }));
      const { result } = await loaded();

      await act(async () => {
        await result.current.remove(11);
      });

      expect(result.current.entries?.map((n) => n.id)).toEqual([12]);
    });

    it('코드 없는 404(삭제 API가 없는 서버)는 실패로 되돌린다', async () => {
      mockServer(() => ({ ok: false, status: 404, text: async () => '<html>Not Found</html>' }));
      const { result } = await loaded();

      await act(async () => {
        await result.current.remove(11);
      });

      await waitFor(() => expect(result.current.entries?.map((n) => n.id)).toEqual([12, 11]));
    });

    it('전체 삭제는 목록을 비우고 더보기를 닫는다', async () => {
      const calls = mockServer(() => ({ ok: true, status: 204, text: async () => '' }));
      const { result } = await loaded();
      expect(result.current.hasNext).toBe(true);

      await act(async () => {
        await result.current.removeAll();
      });

      expect(calls.some((c) => c.method === 'DELETE' && /\/notifications$/.test(c.url))).toBe(true);
      expect(result.current.entries).toEqual([]);
      expect(result.current.hasNext).toBe(false);
      expect(result.current.unreadCount).toBe(0);
    });

    it('전체 삭제가 실패하면 목록과 더보기를 되돌린다', async () => {
      mockServer(() => ({ ok: false, status: 500, text: async () => '{}' }));
      const { result } = await loaded();

      await act(async () => {
        await result.current.removeAll();
      });

      await waitFor(() => expect(result.current.entries).toHaveLength(2));
      expect(result.current.hasNext).toBe(true);
    });
  });

  it('marks everything read via read-all', async () => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      return res(PAGE_1);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotifications());
    await act(async () => {
      await result.current.load();
    });
    await act(async () => {
      await result.current.markAllRead();
    });

    expect(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/notifications/read-all'))).toBe(true); // prettier-ignore
    expect(result.current.unreadCount).toBe(0);
  });
});
