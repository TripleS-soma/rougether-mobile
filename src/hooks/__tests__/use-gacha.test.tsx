import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useGacha } from '@/hooks/use-gacha';

const res = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});

const MACHINES = {
  items: [
    { gachaId: 1, name: '한옥 뽑기', costCurrencyType: 'COIN', costAmount: 100 }, // prettier-ignore
  ],
};

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useGacha', () => {
  it('loads the machine list on mount', async () => {
    global.fetch = jest.fn(async () => res(MACHINES)) as unknown as typeof fetch;

    const { result } = await renderHook(() => useGacha(jest.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(false);
    expect(result.current.gachas).toHaveLength(1);
  });

  // 로드 실패는 빈 상태('뽑기 없음')로 위장하지 않는다 (#549).
  it('로드 실패 시 error, 재시도 성공 시 해제된다 (#549)', async () => {
    let broken = true;
    global.fetch = jest.fn(async () => {
      if (broken) return { ok: false, status: 500, text: async () => '{}' };
      return res(MACHINES);
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useGacha(jest.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.gachas).toEqual([]);

    broken = false;
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.error).toBe(false);
    expect(result.current.gachas).toHaveLength(1);
  });
});
