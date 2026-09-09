import { apiGet } from '@/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearSession, devLogin, getAccessToken, refreshSession } from '@/api/auth';

const res = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

const realFetch = global.fetch;
afterEach(async () => {
  global.fetch = realFetch;
  await clearSession();
});

const seedSession = async () => {
  global.fetch = jest.fn(async () =>
    res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' }),
  ) as unknown as typeof fetch;
  await devLogin(1);
};

describe('refreshSession — single-flight (#515)', () => {
  it('동시 401 여러 개가 갱신을 한 번만 뛰게 한다 (1회용 토큰 경쟁 방지)', async () => {
    await seedSession();

    let refreshCalls = 0;
    let dataCalls = 0;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        // 갱신이 "느린" 동안 다른 401들이 도착하는 상황 재현.
        await new Promise((r) => setTimeout(r, 20));
        return res(200, { accessToken: 'a2', refreshToken: 'r2' });
      }
      dataCalls += 1;
      const token = (init?.headers as Record<string, string>)?.Authorization;
      // 만료된 a1은 401, 갱신된 a2는 200.
      if (token === 'Bearer a1') return res(401, { code: 'AUTH_TOKEN_EXPIRED' });
      return res(200, { items: [] });
    }) as unknown as typeof fetch;

    const [r1, r2, r3] = await Promise.all([
      apiGet('/routines'),
      apiGet('/todos'),
      apiGet('/me/wallets'),
    ]);
    expect(r1).toEqual({ items: [] });
    expect(r2).toEqual({ items: [] });
    expect(r3).toEqual({ items: [] });
    // 핵심: 3개 요청이 401을 맞아도 /auth/refresh는 정확히 1회.
    expect(refreshCalls).toBe(1);
    expect(dataCalls).toBe(6); // 401 3회 + 재시도 200 3회
    expect(getAccessToken()).toBe('a2');
  });

  it('네트워크 오류로 갱신이 실패하면 세션을 지우지 않는다', async () => {
    await seedSession();

    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) throw new TypeError('Network request failed');
      return res(401, { code: 'AUTH_TOKEN_EXPIRED' });
    }) as unknown as typeof fetch;

    await expect(apiGet('/routines')).rejects.toThrow();
    // 오프라인이었을 뿐 — 세션은 살아 있어 다음 요청이 재갱신을 시도한다.
    expect(getAccessToken()).toBe('a1');
  });

  it('서버가 리프레시 토큰을 거부하면 세션을 지운다 (진짜 만료)', async () => {
    await seedSession();

    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) return res(401, { code: 'AUTH_REFRESH_TOKEN_INVALID' });
      return res(401, { code: 'AUTH_TOKEN_EXPIRED' });
    }) as unknown as typeof fetch;

    await expect(apiGet('/routines')).rejects.toThrow();
    expect(getAccessToken()).toBeNull();
  });

  it('갱신이 5xx(서버 순단)면 세션을 보존한다', async () => {
    await seedSession();

    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) return res(503, { code: 'GATEWAY_TIMEOUT' });
      return res(401, { code: 'AUTH_TOKEN_EXPIRED' });
    }) as unknown as typeof fetch;

    await expect(apiGet('/routines')).rejects.toThrow();
    // 재배포 순단일 뿐 — 로그아웃하지 않고 다음 기회를 기다린다.
    expect(getAccessToken()).toBe('a1');
  });

  it('갱신 완료 후의 다음 갱신은 새로 뛴다 (플라이트 해제)', async () => {
    await seedSession();
    let refreshCalls = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return res(200, {
          accessToken: `a${refreshCalls + 1}`,
          refreshToken: `r${refreshCalls + 1}`,
        });
      }
      return res(200, {});
    }) as unknown as typeof fetch;

    expect(await refreshSession()).toBe(true);
    expect(await refreshSession()).toBe(true);
    expect(refreshCalls).toBe(2);
  });
});

describe('refreshSession — 웹 다중 탭 (#1261)', () => {
  it('다른 탭이 이미 회전해 저장소가 새 쌍이면 서버를 부르지 않고 그 쌍을 채택한다', async () => {
    await seedSession();
    // 다른 탭이 회전한 결과가 저장소에만 있는 상황.
    await AsyncStorage.setItem('rougether.auth.accessToken', 'a-sibling');
    await AsyncStorage.setItem('rougether.auth.refreshToken', 'r-sibling');

    let refreshCalls = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) refreshCalls += 1;
      return res(200, { accessToken: 'never', refreshToken: 'never' });
    }) as unknown as typeof fetch;

    await expect(refreshSession()).resolves.toBe(true);
    expect(refreshCalls).toBe(0);
    expect(getAccessToken()).toBe('a-sibling');
  });

  it('저장소가 메모리와 같으면 종전대로 서버에 회전을 요청한다', async () => {
    await seedSession();
    let sent: string | undefined;
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/auth/refresh')) {
        sent = (JSON.parse(String(init?.body)) as { refreshToken: string }).refreshToken;
        return res(200, { accessToken: 'a2', refreshToken: 'r2' });
      }
      return res(200, {});
    }) as unknown as typeof fetch;

    await expect(refreshSession()).resolves.toBe(true);
    expect(sent).toBe('r1');
    expect(getAccessToken()).toBe('a2');
    expect(await AsyncStorage.getItem('rougether.auth.refreshToken')).toBe('r2');
  });

  it('Web Locks가 있으면 갱신을 그 잠금 안에서 돌린다', async () => {
    await seedSession();
    const request = jest.fn((_name: string, cb: () => Promise<unknown>) => cb());
    const nav = globalThis as { navigator?: unknown };
    const original = nav.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request } },
    });
    try {
      global.fetch = jest.fn(async () =>
        res(200, { accessToken: 'a2', refreshToken: 'r2' }),
      ) as unknown as typeof fetch;
      await expect(refreshSession()).resolves.toBe(true);
      expect(request).toHaveBeenCalledWith('rougether.auth.refresh', expect.any(Function));
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original });
    }
  });
});
