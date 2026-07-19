import { registerDeviceToken, unregisterDeviceToken } from '@/api/device-tokens';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

const ok = { ok: true, status: 200, text: async () => '{}' };

describe('device-tokens API (#250)', () => {
  it('registers the token with its platform', async () => {
    const spy = jest.fn(async () => ok);
    global.fetch = spy as unknown as typeof fetch;
    await registerDeviceToken('fcm-abc', 'ANDROID');
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/users/me/device-tokens');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'fcm-abc', platform: 'ANDROID' });
  });

  it('unregisters via the token query param (URL-encoded)', async () => {
    const spy = jest.fn(async () => ok);
    global.fetch = spy as unknown as typeof fetch;
    await unregisterDeviceToken('a b+c');
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/users/me/device-tokens?token=a%20b%2Bc');
    expect(init.method).toBe('DELETE');
  });
});
