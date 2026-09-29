import { API_BASE } from '@/api/config';
import {
  cancelMarketOrder,
  fetchMarketAsset,
  fetchMarketAssets,
  fetchMarketCommand,
  fetchMarketTrades,
  fetchMyMarketOrders,
  issueMarketAsset,
  placeMarketOrder,
  toMarketAssetCard,
  toMarketOrder,
} from '@/api/market';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

function mockResponse(data: unknown, status = 200) {
  const fetchMock = jest.fn(async () => ({
    ok: status < 400,
    status,
    text: async () => JSON.stringify(data),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const call = (fetchMock: jest.Mock, i = 0) => {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
  return { url, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined };
};

describe('거래소 API (#1427)', () => {
  it('목록 — page·size 쿼리, offset 페이지의 hasNext, 탈퇴 제작자는 null', async () => {
    const fetchMock = mockResponse({
      items: [
        {
          assetId: 1,
          itemId: 320,
          name: '고양이 소파',
          assetKey: 'items/photo-furniture/furniture/a.png',
          creatorNickname: null,
          totalSupply: 5,
          bestAskPrice: null,
          askQuantity: 0,
          lastTradePrice: 30,
          status: 'ACTIVE',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 42,
    });
    const page = await fetchMarketAssets({ page: 0, size: 20 });
    expect(call(fetchMock)).toMatchObject({
      url: `${API_BASE}/market/assets?page=0&size=20`,
      method: 'GET',
    });
    expect(page.hasNext).toBe(true);
    expect(page.items[0]).toMatchObject({
      assetId: 1,
      creatorNickname: null,
      bestAskPrice: null,
      lastTradePrice: 30,
    });
  });

  it('상세 — 호가를 정규화하고 최저 판매가는 asks[0]', async () => {
    const fetchMock = mockResponse({
      assetId: 7,
      name: '책상',
      isCreator: true,
      totalSupply: 5,
      unissuedQuantity: 4,
      owned: true,
      status: 'SUSPENDED',
      asks: [
        { price: 28, quantity: 1 },
        { price: 30, quantity: 2 },
      ],
      bids: [{ price: 25, quantity: 1 }],
    });
    const asset = await fetchMarketAsset(7);
    expect(call(fetchMock).url).toBe(`${API_BASE}/market/assets/7`);
    expect(asset).toMatchObject({
      assetId: 7,
      isCreator: true,
      unissuedQuantity: 4,
      owned: true,
      status: 'SUSPENDED',
      bestAskPrice: 28,
      askQuantity: 3,
      lastTradePrice: null,
    });
  });

  it('최근 체결·내 주문·접수 결과 경로', async () => {
    let fetchMock = mockResponse({ items: [{ tradeId: 1, price: 30, quantity: 1 }] });
    await fetchMarketTrades(7, { size: 10 });
    expect(call(fetchMock).url).toBe(`${API_BASE}/market/assets/7/trades?page=0&size=10`);

    fetchMock = mockResponse({ items: [], page: 0, size: 20, totalElements: 0 });
    await fetchMyMarketOrders({ status: 'CLOSED', size: 20 });
    expect(call(fetchMock).url).toBe(`${API_BASE}/me/market/orders?status=CLOSED&page=0&size=20`);

    fetchMock = mockResponse({
      commandId: 10,
      status: 'APPLIED',
      rejectCode: null,
      order: { orderId: 5, assetId: 7, side: 'BUY', status: 'FILLED', price: 30, quantity: 1 },
    });
    const command = await fetchMarketCommand(10);
    expect(call(fetchMock).url).toBe(`${API_BASE}/market/commands/10`);
    expect(command).toMatchObject({ status: 'APPLIED', order: { orderId: 5, status: 'FILLED' } });
  });

  it('구매 주문 — source는 null로 보낸다, 202 접수', async () => {
    const fetchMock = mockResponse({ commandId: 10, status: 'PENDING' }, 202);
    const command = await placeMarketOrder({
      requestId: 'r-1',
      assetId: 1,
      side: 'BUY',
      price: 30,
      quantity: 1,
      source: 'INVENTORY',
    });
    expect(call(fetchMock)).toEqual({
      url: `${API_BASE}/market/orders`,
      method: 'POST',
      body: { requestId: 'r-1', assetId: 1, side: 'BUY', price: 30, quantity: 1, source: null },
    });
    expect(command).toEqual({ commandId: 10, status: 'PENDING', rejectCode: null, order: null });
  });

  it('발행 재고 판매 — source ISSUANCE·수량 그대로', async () => {
    const fetchMock = mockResponse({ commandId: 11, status: 'PENDING' }, 202);
    await placeMarketOrder({
      requestId: 'r-2',
      assetId: 1,
      side: 'SELL',
      price: 40,
      quantity: 3,
      source: 'ISSUANCE',
    });
    expect(call(fetchMock).body).toEqual({
      requestId: 'r-2',
      assetId: 1,
      side: 'SELL',
      price: 40,
      quantity: 3,
      source: 'ISSUANCE',
    });
  });

  it('취소·발행 본문', async () => {
    let fetchMock = mockResponse({ commandId: 12, status: 'PENDING' }, 202);
    await cancelMarketOrder(5, 'r-3');
    expect(call(fetchMock)).toEqual({
      url: `${API_BASE}/market/orders/5/cancel`,
      method: 'POST',
      body: { requestId: 'r-3' },
    });

    fetchMock = mockResponse(
      { assetId: 9, status: 'ACTIVE', totalSupply: 5, unissuedQuantity: 4, isCreator: true },
      201,
    );
    const asset = await issueMarketAsset({ userItemId: 77, totalSupply: 5 });
    expect(call(fetchMock)).toEqual({
      url: `${API_BASE}/market/assets`,
      method: 'POST',
      body: { userItemId: 77, totalSupply: 5 },
    });
    expect(asset).toMatchObject({ assetId: 9, unissuedQuantity: 4 });
  });

  it('상태·방향이 빠진 응답을 그럴듯한 값으로 채우지 않는다', () => {
    expect(toMarketOrder({ orderId: 1, assetId: 2, side: 'SELL' })).toBeNull();
    expect(toMarketOrder({ orderId: 1, assetId: 2, status: 'OPEN' })).toBeNull();
    expect(toMarketAssetCard({ assetId: 1, name: '의자' })).toBeNull();
    expect(toMarketOrder({ orderId: 1, assetId: 2, side: 'SELL', status: 'OPEN' })).toMatchObject({
      side: 'SELL',
      status: 'OPEN',
    });
  });
});
