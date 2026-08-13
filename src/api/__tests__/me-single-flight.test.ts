import { fetchMe } from '@/api/me';

const res = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('fetchMe — single-flight (PR #542 안전망)', () => {
  it('동시 호출 두 번이 네트워크 요청을 한 번만 보내고 같은 결과를 받는다', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      // 요청이 "느린" 동안 두 번째 호출이 도착하는 상황 재현.
      await new Promise((r) => setTimeout(r, 20));
      return res(200, { userId: 7, nickname: '주스' });
    }) as unknown as typeof fetch;

    const [a, b] = await Promise.all([fetchMe(), fetchMe()]);
    expect(calls).toBe(1);
    expect(a).toEqual({ userId: 7, nickname: '주스' });
    // 두 호출 모두 같은 in-flight Promise의 결과를 공유한다.
    expect(b).toBe(a);
  });

  it('앞선 요청이 끝난 뒤의 호출은 새로 요청한다 (완료 시 in-flight 해제)', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      return res(200, { userId: 7, nickname: `호출${calls}` });
    }) as unknown as typeof fetch;

    const first = await fetchMe();
    const second = await fetchMe();
    expect(calls).toBe(2);
    expect(first.nickname).toBe('호출1');
    expect(second.nickname).toBe('호출2');
  });

  it('요청이 실패해도 in-flight가 해제되어 다음 호출이 재시도한다', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) return res(500, { code: 'INTERNAL_ERROR' });
      return res(200, { userId: 7, nickname: '주스' });
    }) as unknown as typeof fetch;

    await expect(fetchMe()).rejects.toThrow();
    await expect(fetchMe()).resolves.toEqual({ userId: 7, nickname: '주스' });
    expect(calls).toBe(2);
  });
});
