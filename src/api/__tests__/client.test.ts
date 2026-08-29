import { apiGet, apiGetList } from '@/api/client';
import { fetchMe } from '@/api/me';
import { clearSession, devLogin, getAccessToken, onSessionCleared } from '@/api/auth';
import { track } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({
  ...jest.requireActual('@/lib/analytics'),
  track: jest.fn(),
}));
const trackMock = track as jest.MockedFunction<typeof track>;

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

  it('clears the session and notifies listeners when the refresh also fails', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (url.endsWith('/auth/dev-login')) {
        return res(200, { userId: 1, accessToken: 'a1', refreshToken: 'r1' });
      }
      if (url.endsWith('/auth/refresh')) {
        return res(401, { message: 'refresh expired' });
      }
      return res(401, { message: 'expired' });
    }) as unknown as typeof fetch;

    await devLogin(1);
    const cleared = jest.fn();
    const unsubscribe = onSessionCleared(cleared);

    await expect(fetchMe()).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(cleared).toHaveBeenCalled();
    unsubscribe();
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

/**
 * api_error 계측 (#799 → #1010). 상태코드를 **숫자**로 보내던 동안 GA4에서
 * 조회가 통째로 비어 있었다 — 이벤트 범위 맞춤 측정기준은 `string_value`만
 * 읽는데 숫자는 `int_value`로 들어간다(2026-08-29 실측: 같은 이벤트에서
 * endpoint는 값이 붙고 status만 `(not set)`이었다).
 */
describe('api_error 계측', () => {
  it('상태코드를 문자열로 보낸다 — 숫자면 GA4 측정기준이 비어 나온다', async () => {
    global.fetch = jest.fn(async () => res(404)) as unknown as typeof fetch;
    await expect(apiGet('/events/attendance')).rejects.toBeTruthy();

    const call = trackMock.mock.calls.find(([name]) => name === 'api_error');
    expect(call).toBeTruthy();
    expect(call?.[1]).toEqual({ endpoint: 'GET /events/attendance', status: '404' });
    expect(typeof call?.[1]?.status).toBe('string');
  });

  it('응답이 없는 네트워크 실패는 문자열 0으로 남는다', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(apiGet('/events/attendance')).rejects.toBeTruthy();

    const call = trackMock.mock.calls.find(([name]) => name === 'api_error');
    expect(call?.[1]?.status).toBe('0');
  });

  it('경로의 숫자 id는 지운다 — GA4 카디널리티·식별정보 방지', async () => {
    global.fetch = jest.fn(async () => res(403)) as unknown as typeof fetch;
    await expect(apiGet('/houses/6/join-requests?page=2')).rejects.toBeTruthy();

    const call = trackMock.mock.calls.find(([name]) => name === 'api_error');
    expect(call?.[1]?.endpoint).toBe('GET /houses/{id}/join-requests');
  });
});

/**
 * 정상 경로를 장애로 세지 않는다 (#1010). GA4에서 엔드포인트가 붙은 api_error
 * 21건 중 18건이 `GET /events/attendance`의 404였는데, useAttendance가 이미
 * `ATTENDANCE_EVENT_NOT_FOUND`로 접는 **정상 상태**였다.
 */
describe('expectedStatuses', () => {
  it('호출부가 정상으로 선언한 상태코드는 api_error로 세지 않는다', async () => {
    global.fetch = jest.fn(async () => res(404)) as unknown as typeof fetch;
    await expect(apiGet('/events/attendance', { expectedStatuses: [404] })).rejects.toBeTruthy();
    expect(trackMock.mock.calls.filter(([name]) => name === 'api_error')).toHaveLength(0);
  });

  it('선언하지 않은 상태코드는 그대로 센다', async () => {
    global.fetch = jest.fn(async () => res(500)) as unknown as typeof fetch;
    await expect(apiGet('/events/attendance', { expectedStatuses: [404] })).rejects.toBeTruthy();
    const call = trackMock.mock.calls.find(([name]) => name === 'api_error');
    expect(call?.[1]?.status).toBe('500');
  });

  it('던지는 동작은 그대로 — 계측에서만 빠진다', async () => {
    global.fetch = jest.fn(async () => res(404)) as unknown as typeof fetch;
    await expect(apiGet('/events/attendance', { expectedStatuses: [404] })).rejects.toBeTruthy();
  });
});
