import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useNotificationSettings } from '@/hooks/use-notification-settings';

const res = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(body),
});

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useNotificationSettings', () => {
  it('loads server settings and PATCHes only the flipped key', async () => {
    const calls: { url: string; method?: string; body?: string }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method, body: init?.body as string });
      if (init?.method === 'PATCH') return res({ all: true, reminder: false, house: true });
      return res({ all: true, reminder: true, house: false });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotificationSettings());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.settings).toEqual({ all: true, reminder: true, house: false });

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

  it('rolls back the optimistic toggle and reports when the PATCH fails', async () => {
    const onError = jest.fn();
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return res({ code: 'X' }, 500);
      return res({ all: true, reminder: true, house: true });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useNotificationSettings(onError));
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
