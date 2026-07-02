import { apiGetList } from '@/api/client';
import { fetchMe } from '@/api/me';
import { clearSession, devLogin, getAccessToken } from '@/api/auth';

type MockRes = { ok: boolean; status: number; text: () => Promise<string> };
const res = (status: number, body?: unknown): MockRes => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

const realFetch = global.fetch;
afterEach(async () => {
  await clearSession();
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('API client', () => {
  it('dev-login stores the session and injects the bearer token on authed calls', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/auth/dev-login')) {
        return res(200, { userId: 7, accessToken: 'a1', refreshToken: 'r1', isNewUser: false });
      }
      return res(200, { userId: 7, nickname: '준서' });
    }) as unknown as typeof fetch;

    await devLogin(7);
    expect(getAccessToken()).toBe('a1');

    const me = await fetchMe();
    expect(me.nickname).toBe('준서');
    const meCall = calls.find((c) => c.url.endsWith('/me'));
    expect((meCall?.init?.headers as Record<string, string>).Authorization).toBe('Bearer a1');
  });

  it('refreshes the token once on a 401 and replays the request', async () => {
    let meCalls = 0;
    const seen: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/dev-login')) {
        return res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' });
      }
      if (url.endsWith('/auth/refresh')) {
        return res(200, { accessToken: 'a2', refreshToken: 'r2' });
      }
      // /me: first call 401, second (post-refresh) succeeds.
      seen.push((init?.headers as Record<string, string>)?.Authorization);
      meCalls += 1;
      return meCalls === 1 ? res(401, { message: 'expired' }) : res(200, { userId: 1 });
    }) as unknown as typeof fetch;

    await devLogin(1);
    const me = await fetchMe();

    expect(me.userId).toBe(1);
    expect(meCalls).toBe(2);
    // Replay used the refreshed token.
    expect(seen).toEqual(['Bearer a1', 'Bearer a2']);
    expect(getAccessToken()).toBe('a2');
  });

  it('unwraps the { items } list envelope', async () => {
    global.fetch = jest.fn(async () =>
      res(200, { items: [{ id: 1 }, { id: 2 }] }),
    ) as unknown as typeof fetch;
    const list = await apiGetList<{ id: number }>('/todos');
    expect(list).toHaveLength(2);
    expect(list[1].id).toBe(2);
  });
});
