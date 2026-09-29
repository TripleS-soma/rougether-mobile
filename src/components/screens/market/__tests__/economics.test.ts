import {
  defaultOrderPrice,
  expectedProceeds,
  expiryLabel,
  isRoyaltyFree,
  parseOrderPrice,
} from '@/components/screens/market/economics';

describe('거래소 금액 계산 (#1427)', () => {
  it('spec 예: 30코인 되팔기 → 로열티 3·소각 1 → 26', () => {
    expect(expectedProceeds({ price: 30, royaltyFree: false })).toBe(26);
  });

  it('제작자 본인(또는 탈퇴한 제작자) 판매는 로열티 0 → 30 − 1 = 29', () => {
    expect(expectedProceeds({ price: 30, royaltyFree: true })).toBe(29);
    expect(isRoyaltyFree({ isCreator: true, creatorNickname: '영희' })).toBe(true);
    expect(isRoyaltyFree({ isCreator: false, creatorNickname: null })).toBe(true);
    expect(isRoyaltyFree({ isCreator: false, creatorNickname: '영희' })).toBe(false);
  });

  it('로열티·수수료는 각각 내림 — 작은 금액은 떼는 게 없다', () => {
    expect(expectedProceeds({ price: 1, royaltyFree: false })).toBe(1);
    expect(expectedProceeds({ price: 19, royaltyFree: false })).toBe(19 - 1 - 0);
    expect(expectedProceeds({ price: 1000, royaltyFree: false })).toBe(850);
  });

  it('여러 개는 1개씩(체결마다) 내림한 뒤 곱한다', () => {
    // 7코인 × 3: 체결마다 수수료 floor(0.35)=0 → 21. 합계에 한 번 내림하면 floor(1.05)=1이라 20.
    expect(expectedProceeds({ price: 7, quantity: 3, royaltyFree: true })).toBe(21);
    expect(expectedProceeds({ price: 30, quantity: 4, royaltyFree: true })).toBe(29 * 4);
  });

  it('가격 입력 — 1~1,000 정수만', () => {
    expect(parseOrderPrice('30')).toBe(30);
    expect(parseOrderPrice('1,000')).toBe(1000);
    expect(parseOrderPrice('0')).toBeNull();
    expect(parseOrderPrice('1001')).toBeNull();
    expect(parseOrderPrice('12.5')).toBeNull();
    expect(parseOrderPrice('')).toBeNull();
  });

  it('초깃값 — 구매는 최저 판매가, 판매는 최근 거래가, 둘 다 없으면 빈칸', () => {
    const asset = { bestAskPrice: 28, lastTradePrice: 30 };
    expect(defaultOrderPrice('BUY', asset)).toBe(28);
    expect(defaultOrderPrice('SELL', asset)).toBe(30);
    expect(defaultOrderPrice('BUY', { bestAskPrice: null, lastTradePrice: 30 })).toBe(30);
    expect(defaultOrderPrice('SELL', { bestAskPrice: 28, lastTradePrice: null })).toBe(28);
    expect(defaultOrderPrice('BUY', { bestAskPrice: null, lastTradePrice: null })).toBeNull();
  });

  it('만료 라벨 — 일·시간·곧', () => {
    const now = new Date('2026-09-29T00:00:00Z');
    expect(expiryLabel('2026-10-05T12:00:00Z', now)).toEqual({ key: 'days', n: 6 });
    expect(expiryLabel('2026-09-29T05:30:00Z', now)).toEqual({ key: 'hours', n: 5 });
    expect(expiryLabel('2026-09-29T00:10:00Z', now)).toEqual({ key: 'soon', n: 0 });
    expect(expiryLabel(null, now)).toBeNull();
  });
});
