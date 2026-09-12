import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useNotificationSettings } from '@/hooks/use-notification-settings';
import { jsonRes as res } from '@/test-utils/fetch';
import { queryWrapper } from '@/test-utils/query-wrapper';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('useNotificationSettings', () => {
  it('loads server settings and PATCHes only the flipped key', async () => {
    const calls: { url: string; method?: string; body?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method, body: init?.body as string });
      if (init?.method === 'PATCH') return res({ all: true, reminder: false, house: true });
      return res({ all: true, reminder: true, house: false });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotificationSettings(), {
      wrapper: queryWrapper(),
    });
    await act(async () => {
      await result.current.load();
    });
    // 캐시 반영은 notifyManager가 배칭한다 — 즉시 단언하지 않고 기다린다.
    await waitFor(() =>
      expect(result.current.settings).toEqual({ all: true, reminder: true, house: false }),
    );

    await act(async () => {
      result.current.toggle('reminder', false);
    });
    await waitFor(() =>
      expect(result.current.settings).toEqual({ all: true, reminder: false, house: true }),
    );
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.url).toContain('/users/me/notification-settings');
    expect(JSON.parse(patch?.body ?? '{}')).toEqual({ reminder: false });
  });

  // 조회 실패 시 기본값이 서버값처럼 보이지 않도록 loadError를 노출한다 (#549).
  it('로드 실패 시 loadError, 재조회 성공 시 해제된다 (#549)', async () => {
    let broken = true;
    global.fetch = jest.fn(async () => {
      if (broken) return res({ code: 'X' }, 500);
      return res({ all: true, reminder: false, house: true });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotificationSettings(), {
      wrapper: queryWrapper(),
    });
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.loadError).toBe(true));
    // 실패 시엔 기본값 유지.
    expect(result.current.settings).toEqual({ all: true, reminder: true, house: true });

    broken = false;
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.loadError).toBe(false));
    expect(result.current.settings).toEqual({ all: true, reminder: false, house: true });
  });

  it('rolls back the optimistic toggle and reports when the PATCH fails', async () => {
    const onError = jest.fn();
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return res({ code: 'X' }, 500);
      return res({ all: true, reminder: true, house: true });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotificationSettings(onError), {
      wrapper: queryWrapper(),
    });
    await act(async () => {
      await result.current.load();
    });

    await act(async () => {
      result.current.toggle('house', false);
    });
    // 낙관적 반영 → 실패 → 원복.
    await waitFor(() => expect(result.current.settings.house).toBe(true));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
