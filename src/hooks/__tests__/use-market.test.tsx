import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/http';
import {
  cancelMarketOrder,
  fetchMarketCommand,
  issueMarketAsset,
  placeMarketOrder,
  type MarketCommand,
} from '@/api/market';
import { useMarketActions, type MarketOrderInput } from '@/hooks/use-market';
import { DEMO_MARKET_ASSET } from '@/mocks/fixtures';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/market', () => ({
  ...jest.requireActual('@/api/market'),
  placeMarketOrder: jest.fn(),
  cancelMarketOrder: jest.fn(),
  fetchMarketCommand: jest.fn(),
  issueMarketAsset: jest.fn(),
}));

const pending: MarketCommand = { commandId: 10, status: 'PENDING', rejectCode: null, order: null };
const applied = (status: 'FILLED' | 'OPEN'): MarketCommand => ({
  commandId: 10,
  status: 'APPLIED',
  rejectCode: null,
  order: {
    orderId: 5,
    assetId: 1,
    name: '고양이 소파',
    assetKey: null,
    side: 'BUY',
    source: null,
    price: 30,
    quantity: 1,
    filledQuantity: status === 'FILLED' ? 1 : 0,
    status,
    expiresAt: null,
    createdAt: null,
  },
});
const rejected = (code: string): MarketCommand => ({
  commandId: 10,
  status: 'REJECTED',
  rejectCode: code,
  order: null,
});

const BUY: MarketOrderInput = { assetId: 1, side: 'BUY', price: 30, quantity: 1 };
const SELL: MarketOrderInput = {
  assetId: 1,
  side: 'SELL',
  source: 'INVENTORY',
  price: 30,
  quantity: 1,
};
const noWait = { sleep: () => Promise.resolve(), intervalMs: 0, tries: 3 };

async function setup(client: QueryClient = createTestQueryClient()) {
  const toast = jest.fn();
  const onWalletChanged = jest.fn();
  const hook = await renderHook(() => useMarketActions({ toast, onWalletChanged, poll: noWait }), {
    wrapper: queryWrapper(client),
  });
  return { ...hook, toast, onWalletChanged, client };
}

beforeEach(() => {
  jest.mocked(placeMarketOrder).mockReset().mockResolvedValue(pending);
  jest.mocked(cancelMarketOrder).mockReset().mockResolvedValue(pending);
  jest.mocked(fetchMarketCommand).mockReset();
  jest.mocked(issueMarketAsset).mockReset();
});

describe('useMarketActions — 주문 흐름 (#1427)', () => {
  it('APPLIED + FILLED → "구매 완료", 지갑·인벤토리·방·거래소를 무효화', async () => {
    jest
      .mocked(fetchMarketCommand)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(applied('FILLED'));
    const client = createTestQueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result, toast, onWalletChanged } = await setup(client);

    let outcome;
    await act(async () => {
      outcome = await result.current.placeOrder(BUY);
    });
    expect(outcome).toEqual({ accepted: true, result: 'filled' });
    expect(fetchMarketCommand).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenCalledWith('구매 완료', 'success');
    expect(onWalletChanged).toHaveBeenCalled();
    const keys = invalidate.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['market', undefined],
        ['me', 'items'],
        ['rooms', 'me'],
        ['wallet-history', undefined],
      ]),
    );
  });

  it('APPLIED + OPEN → 판매는 "판매 대기 중이에요"', async () => {
    jest.mocked(fetchMarketCommand).mockResolvedValue({
      ...applied('OPEN'),
      order: { ...applied('OPEN').order!, side: 'SELL' },
    });
    const { result, toast } = await setup();
    let outcome;
    await act(async () => {
      outcome = await result.current.placeOrder(SELL);
    });
    expect(outcome).toEqual({ accepted: true, result: 'open' });
    expect(toast).toHaveBeenCalledWith('판매 대기 중이에요', undefined);
  });

  it('REJECTED → 거절 사유 문구(환불 안내), UNREFUNDED는 고객센터', async () => {
    jest.mocked(fetchMarketCommand).mockResolvedValue(rejected('MARKET_SELF_TRADE'));
    const { result, toast } = await setup();
    let outcome;
    await act(async () => {
      outcome = await result.current.placeOrder(BUY);
    });
    expect(outcome).toEqual({
      accepted: true,
      result: 'rejected',
      rejectCode: 'MARKET_SELF_TRADE',
    });
    expect(toast).toHaveBeenCalledWith(
      '내 주문과 맞물려 처리하지 못했어요. 맡긴 코인·가구는 돌려드렸어요.',
      'error',
    );

    jest.mocked(fetchMarketCommand).mockResolvedValue(rejected('MARKET_ENGINE_ERROR_UNREFUNDED'));
    await act(async () => {
      await result.current.placeOrder(BUY);
    });
    expect(toast).toHaveBeenLastCalledWith('처리에 실패했어요. 고객센터로 문의해 주세요.', 'error');
  });

  it('폴링 끝까지 PENDING → "처리 중이에요. 내 주문에서 확인해 주세요."', async () => {
    jest.mocked(fetchMarketCommand).mockResolvedValue(pending);
    const { result, toast, onWalletChanged } = await setup();
    let outcome;
    await act(async () => {
      outcome = await result.current.placeOrder(BUY);
    });
    expect(outcome).toEqual({ accepted: true, result: 'pending' });
    expect(fetchMarketCommand).toHaveBeenCalledTimes(noWait.tries);
    expect(toast).toHaveBeenCalledWith('처리 중이에요. 내 주문에서 확인해 주세요.');
    // 접수 순간 에스크로가 일어났으니 PENDING이어도 지갑을 다시 받는다.
    expect(onWalletChanged).toHaveBeenCalled();
  });

  it('네트워크 재시도는 같은 requestId, 새 탭은 새 requestId', async () => {
    jest.mocked(fetchMarketCommand).mockResolvedValue(applied('FILLED'));
    jest
      .mocked(placeMarketOrder)
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending);
    const { result } = await setup();

    await act(async () => {
      await result.current.placeOrder(BUY);
    });
    const first = jest.mocked(placeMarketOrder).mock.calls.map((c) => c[0].requestId);
    expect(first).toHaveLength(2);
    expect(first[0]).toBe(first[1]);
    expect(first[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await act(async () => {
      await result.current.placeOrder(BUY);
    });
    const third = jest.mocked(placeMarketOrder).mock.calls[2][0].requestId;
    expect(third).not.toBe(first[0]);
  });

  it('재시도까지 네트워크 실패면 같은 내용 재탭은 같은 requestId, 내용이 바뀌면 새 requestId', async () => {
    jest.mocked(fetchMarketCommand).mockResolvedValue(applied('FILLED'));
    const net = new TypeError('Network request failed');
    jest
      .mocked(placeMarketOrder)
      .mockRejectedValueOnce(net)
      .mockRejectedValueOnce(net)
      .mockRejectedValueOnce(net)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending);
    const { result } = await setup();

    await act(async () => {
      await result.current.placeOrder(BUY);
    });
    await act(async () => {
      await result.current.placeOrder(BUY);
    });
    const ids = jest.mocked(placeMarketOrder).mock.calls.map((c) => c[0].requestId);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(1);

    await act(async () => {
      await result.current.placeOrder({ ...BUY, price: 31 });
    });
    expect(jest.mocked(placeMarketOrder).mock.calls[4][0].requestId).not.toBe(ids[0]);
  });

  it('4xx 뒤 같은 내용 재탭은 새 requestId — 접수 안 된 게 확실하다', async () => {
    jest
      .mocked(placeMarketOrder)
      .mockRejectedValue(
        new ApiError(
          409,
          'POST',
          '/market/orders',
          JSON.stringify({ code: 'MARKET_INSUFFICIENT_COIN' }),
        ),
      );
    const { result } = await setup();
    await act(async () => {
      await result.current.placeOrder(BUY);
    });
    await act(async () => {
      await result.current.placeOrder(BUY);
    });
    const ids = jest.mocked(placeMarketOrder).mock.calls.map((c) => c[0].requestId);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('즉시 4xx는 재시도하지 않고 코드별 문구 — 접수 안 됨(accepted false)', async () => {
    jest
      .mocked(placeMarketOrder)
      .mockRejectedValue(
        new ApiError(
          409,
          'POST',
          '/market/orders',
          JSON.stringify({ code: 'MARKET_INSUFFICIENT_COIN' }),
        ),
      );
    const { result, toast, onWalletChanged } = await setup();
    let outcome;
    await act(async () => {
      outcome = await result.current.placeOrder(BUY);
    });
    expect(placeMarketOrder).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ accepted: false, result: 'error', code: 'MARKET_INSUFFICIENT_COIN' });
    expect(toast).toHaveBeenCalledWith('코인이 부족해요.', 'error');
    expect(fetchMarketCommand).not.toHaveBeenCalled();
    expect(onWalletChanged).not.toHaveBeenCalled();
  });

  it('취소도 같은 접수 흐름 — APPLIED면 "주문을 취소했어요"', async () => {
    jest.mocked(fetchMarketCommand).mockResolvedValue({ ...pending, status: 'APPLIED' });
    const { result, toast } = await setup();
    let outcome;
    await act(async () => {
      outcome = await result.current.cancelOrder(5);
    });
    expect(cancelMarketOrder).toHaveBeenCalledWith(5, expect.any(String));
    expect(outcome).toEqual({ accepted: true, result: 'cancelled' });
    expect(toast).toHaveBeenCalledWith('주문을 취소했어요', 'success');
  });

  it('발행 — 성공하면 종목을 돌려주고 상세 캐시에 심는다, 실패는 코드 문구', async () => {
    jest.mocked(issueMarketAsset).mockResolvedValueOnce({ ...DEMO_MARKET_ASSET, assetId: 9 });
    const client = createTestQueryClient();
    const { result, toast } = await setup(client);
    let asset;
    await act(async () => {
      asset = await result.current.issueAsset(77, 5);
    });
    expect(issueMarketAsset).toHaveBeenCalledWith({ userItemId: 77, totalSupply: 5 });
    expect(asset).toMatchObject({ assetId: 9 });
    await waitFor(() =>
      expect(client.getQueryData(['market', undefined, 'asset', 9])).toMatchObject({ assetId: 9 }),
    );
    expect(toast).toHaveBeenCalledWith('거래소에 올렸어요', 'success');

    jest
      .mocked(issueMarketAsset)
      .mockRejectedValueOnce(
        new ApiError(
          409,
          'POST',
          '/market/assets',
          JSON.stringify({ code: 'MARKET_ASSET_ALREADY_LISTED' }),
        ),
      );
    await act(async () => {
      asset = await result.current.issueAsset(77, 5);
    });
    expect(asset).toBeNull();
    expect(toast).toHaveBeenLastCalledWith('이미 거래소에 올린 가구예요.', 'error');
  });
});
