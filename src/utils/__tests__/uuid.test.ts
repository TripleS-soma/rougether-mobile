import { newRequestId } from '@/utils/uuid';

/** 서버(거래소 #1427)가 UUID 정규식으로 검증하므로 폴백도 v4 모양이어야 한다. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type CryptoHost = { crypto?: unknown };
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

function setCrypto(value: unknown) {
  Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });
}

afterEach(() => {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
  else delete (globalThis as CryptoHost).crypto;
  jest.restoreAllMocks();
});

describe('newRequestId', () => {
  it('crypto.randomUUID가 있으면 그 값을 그대로 쓴다', () => {
    const randomUUID = jest.fn(() => '11111111-2222-4333-8444-555555555555');
    setCrypto({ randomUUID });
    expect(newRequestId()).toBe('11111111-2222-4333-8444-555555555555');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['crypto 자체가 없을 때', undefined],
    ['randomUUID가 없을 때', {}],
    ['randomUUID가 함수가 아닐 때', { randomUUID: 'nope' }],
  ])('%s — Math.random 폴백이 v4 형식이고 겹치지 않는다', (_label, value) => {
    setCrypto(value);
    const ids = Array.from({ length: 200 }, newRequestId);
    ids.forEach((id) => expect(id).toMatch(UUID_V4));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('폴백의 variant 자리는 난수가 극단값이어도 8·9·a·b 중 하나다', () => {
    setCrypto({});
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(newRequestId()).toBe('00000000-0000-4000-8000-000000000000');
    jest.spyOn(Math, 'random').mockReturnValue(0.9999);
    expect(newRequestId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
});
