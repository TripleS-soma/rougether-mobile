import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { MarketOrder } from '@/api/market';
import { MarketAssetScreen } from '@/components/screens/market-asset-screen';
import { DEMO_MARKET_ASSET, DEMO_MARKET_TRADES } from '@/mocks/fixtures';

const NOW = new Date('2026-09-29T03:00:00Z');

describe('MarketAssetScreen (#1427)', () => {
  it('구매 대기는 보유로 표시하지 않고 구매를 막고 내 주문으로 안내한다', async () => {
    const onOpenOrders = jest.fn();
    const ui = await render(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, owned: false, buyPending: true }}
        onOpenOrders={onOpenOrders}
      />,
    );
    expect(ui.getByLabelText('구매 대기 중').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(ui.queryByLabelText('판매하기')).toBeNull();
    expect(ui.getByText(/체결 상태와 취소는 내 주문/)).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('내 주문'));
    expect(onOpenOrders).toHaveBeenCalled();
  });

  it('판매 대기 중에는 보유 여부와 관계없이 재구매를 막는다', async () => {
    const ui = await render(
      <MarketAssetScreen asset={{ ...DEMO_MARKET_ASSET, owned: false, sellPending: true }} />,
    );
    expect(ui.getByLabelText('구매하기').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(ui.getByText(/판매 주문이 있어 구매할 수 없어요/)).toBeTruthy();
  });

  it('판매 주문이 없으면 구매를 막고 재판매 시 다시 노출됨을 안내한다', async () => {
    const ui = await render(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, owned: false, asks: [], bestAskPrice: null }}
      />,
    );
    expect(ui.getByLabelText('구매하기').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(ui.getByText(/현재 판매 주문이 없어 구매할 수 없어요/)).toBeTruthy();
  });

  it('상세 — 이름·제작자·발행 수·최저 판매가·최근 거래가, 호가 위 3단계, 최근 거래', async () => {
    const ui = await render(
      <MarketAssetScreen asset={DEMO_MARKET_ASSET} trades={DEMO_MARKET_TRADES} now={NOW} />,
    );
    expect(ui.getByText('고양이 소파')).toBeTruthy();
    expect(ui.getByText(/영희 제작/)).toBeTruthy();
    expect(ui.getByText(/총 5개 발행/)).toBeTruthy();
    expect(ui.getAllByText('28코인').length).toBeGreaterThan(0);
    // 호가 4단계 중 위 3단계만.
    expect(ui.queryByText('40코인')).toBeNull();
    expect(ui.getByText('35코인')).toBeTruthy();
    expect(ui.getByText('1시간 전')).toBeTruthy();
    // 보유하지 않았고 제작자도 아니면 구매만.
    expect(ui.getByLabelText('구매하기')).toBeTruthy();
    expect(ui.queryByLabelText('판매하기')).toBeNull();
    expect(ui.queryByLabelText('발행 재고 판매')).toBeNull();
    // 신고는 onReport를 넘겼을 때만.
    expect(ui.queryByLabelText('신고하기')).toBeNull();
  });

  it('탈퇴한 제작자는 "탈퇴한 회원"', async () => {
    const ui = await render(
      <MarketAssetScreen asset={{ ...DEMO_MARKET_ASSET, creatorNickname: null }} />,
    );
    expect(ui.getByText(/탈퇴한 회원/)).toBeTruthy();
  });

  it('보유 중이면 구매를 막고 이유를 적는다, 판매하기가 생긴다', async () => {
    const ui = await render(<MarketAssetScreen asset={{ ...DEMO_MARKET_ASSET, owned: true }} />);
    expect(ui.getByLabelText('구매하기').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(ui.getByText(/이미 가지고 있는 가구예요/)).toBeTruthy();
    expect(ui.getByLabelText('판매하기')).toBeTruthy();
  });

  it('제작자이고 발행 재고가 남았으면 발행 재고 판매', async () => {
    const ui = await render(
      <MarketAssetScreen asset={{ ...DEMO_MARKET_ASSET, isCreator: true, unissuedQuantity: 2 }} />,
    );
    expect(ui.getByLabelText('발행 재고 판매')).toBeTruthy();
    expect(ui.getByText('남은 발행 재고 2개')).toBeTruthy();

    const none = await render(
      <MarketAssetScreen asset={{ ...DEMO_MARKET_ASSET, isCreator: true, unissuedQuantity: 0 }} />,
    );
    expect(none.queryByLabelText('발행 재고 판매')).toBeNull();
  });

  it('거래 정지면 배너 + 버튼 전부 비활성', async () => {
    const ui = await render(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, status: 'SUSPENDED', owned: true, isCreator: true }}
      />,
    );
    expect(ui.getByText('거래가 정지된 가구예요')).toBeTruthy();
    for (const label of ['구매하기', '판매하기', '발행 재고 판매']) {
      expect(ui.getByLabelText(label).props.accessibilityState).toMatchObject({ disabled: true });
    }
  });

  it('onReport를 넘기면 신고하기 → 사유를 골라 종목 id로 신고한다', async () => {
    const onReport = jest.fn().mockResolvedValue(true);
    const ui = await render(<MarketAssetScreen asset={DEMO_MARKET_ASSET} onReport={onReport} />);
    await fireEvent.press(ui.getByLabelText('신고하기'));
    await fireEvent.press(ui.getByLabelText('저작권 침해'));
    await fireEvent.press(ui.getAllByText('신고하기').at(-1)!);
    expect(onReport).toHaveBeenCalledWith(1, 'COPYRIGHT', undefined);
  });

  it('구매 시트 — 최저 판매가로 채우고 보유 코인·환불 안내, 1~1,000 밖이면 막는다', async () => {
    const onPlaceOrder = jest.fn(() => true);
    const ui = await render(
      <MarketAssetScreen asset={DEMO_MARKET_ASSET} coinBalance={50} onPlaceOrder={onPlaceOrder} />,
    );
    await fireEvent.press(ui.getByLabelText('구매하기'));
    const input = ui.getByLabelText('개당 가격 (코인)');
    expect(input.props.value).toBe('28');
    expect(ui.getByText('보유 코인 50')).toBeTruthy();
    expect(ui.getByText(/차액은 코인으로 돌려드려요/)).toBeTruthy();

    await fireEvent.changeText(input, '0');
    expect(ui.getByText('1~1,000코인 사이 정수로 입력해 주세요.')).toBeTruthy();
    expect(ui.getByLabelText('구매 주문하기').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await fireEvent.changeText(input, '60');
    expect(ui.getByText('코인이 부족해요')).toBeTruthy();

    await fireEvent.changeText(input, '30');
    await fireEvent.press(ui.getByLabelText('구매 주문하기'));
    expect(onPlaceOrder).toHaveBeenCalledWith({ side: 'BUY', price: 30, quantity: 1 });
  });

  it('판매 시트 — 최근 거래가로 채우고 예상 수령액(30 → 26)과 인벤토리 경고', async () => {
    const onPlaceOrder = jest.fn(() => true);
    const ui = await render(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, owned: true }}
        onPlaceOrder={onPlaceOrder}
      />,
    );
    await fireEvent.press(ui.getByLabelText('판매하기'));
    expect(ui.getByLabelText('개당 가격 (코인)').props.value).toBe('30');
    expect(ui.getByText('26코인')).toBeTruthy();
    expect(ui.getByText(/판매하는 동안 가구는 인벤토리와 방에서 빠져요/)).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('판매 주문하기'));
    expect(onPlaceOrder).toHaveBeenCalledWith({
      side: 'SELL',
      source: 'INVENTORY',
      price: 30,
      quantity: 1,
    });
  });

  it('발행 재고 판매 — 수량 1~min(10, 남은 재고), 제작자라 로열티 없음', async () => {
    const onPlaceOrder = jest.fn(() => true);
    const ui = await render(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, isCreator: true, unissuedQuantity: 2 }}
        onPlaceOrder={onPlaceOrder}
      />,
    );
    await fireEvent.press(ui.getByLabelText('발행 재고 판매'));
    await fireEvent.press(ui.getByLabelText('수량 늘리기'));
    // 남은 재고 2 — 더 못 늘린다.
    expect(ui.getByLabelText('수량 늘리기').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    // 30코인 × 2, 로열티 0 → (30 − 1) × 2.
    expect(ui.getByText('58코인')).toBeTruthy();
    expect(ui.queryByText(/인벤토리와 방에서 빠져요/)).toBeNull();
    await fireEvent.press(ui.getByLabelText('판매 주문하기'));
    await waitFor(() =>
      expect(onPlaceOrder).toHaveBeenCalledWith({
        side: 'SELL',
        source: 'ISSUANCE',
        price: 30,
        quantity: 2,
      }),
    );
  });
  it('상세에서 내 판매의 가격과 잔량을 보고 선택한 주문만 취소한다', async () => {
    const sale: MarketOrder = {
      orderId: 81,
      assetId: 1,
      name: '고양이 소파',
      assetKey: null,
      side: 'SELL',
      source: 'ISSUANCE',
      price: 50,
      quantity: 3,
      filledQuantity: 1,
      status: 'OPEN',
      expiresAt: null,
      createdAt: null,
    };
    const onCancelOrder = jest.fn().mockResolvedValue(true);
    const ui = await render(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, mySellOrders: [sale, { ...sale, orderId: 82, price: 60 }] }}
        onCancelOrder={onCancelOrder}
      />,
    );
    expect(ui.getByText('50코인, 남은 2개')).toBeTruthy();
    expect(ui.getByText('60코인, 남은 2개')).toBeTruthy();
    await fireEvent.press(ui.getAllByLabelText('판매 취소')[1]);
    expect(ui.getByText(/마지막 판매 주문이면 거래소에서 내려가고/)).toBeTruthy();
    expect(onCancelOrder).not.toHaveBeenCalled();
    await fireEvent.press(ui.getAllByLabelText('판매 취소').at(-1)!);
    await waitFor(() => expect(onCancelOrder).toHaveBeenCalledWith(82));
    await waitFor(() => expect(ui.queryByText('판매를 취소할까요?')).toBeNull());
  });

  it('판매 취소를 거절하면 확인창을 유지하고 재요청할 수 있다', async () => {
    const sale: MarketOrder = {
      orderId: 81,
      assetId: 1,
      name: '고양이 소파',
      assetKey: null,
      side: 'SELL',
      source: 'INVENTORY',
      price: 50,
      quantity: 1,
      filledQuantity: 0,
      status: 'OPEN',
      expiresAt: null,
      createdAt: null,
    };
    const onCancelOrder = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const ui = await render(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, mySellOrders: [sale] }}
        onCancelOrder={onCancelOrder}
      />,
    );
    await fireEvent.press(ui.getByLabelText('판매 취소'));
    await fireEvent.press(ui.getAllByLabelText('판매 취소').at(-1)!);
    await waitFor(() => expect(onCancelOrder).toHaveBeenCalledTimes(1));
    expect(ui.getByText('판매를 취소할까요?')).toBeTruthy();
    await fireEvent.press(ui.getAllByLabelText('판매 취소').at(-1)!);
    await waitFor(() => expect(onCancelOrder).toHaveBeenCalledTimes(2));
  });
  it('판매 취소 처리 중에는 연속 클릭해도 접수를 중복하지 않는다', async () => {
    const sale: MarketOrder = {
      orderId: 81,
      assetId: 1,
      name: '고양이 소파',
      assetKey: null,
      side: 'SELL',
      source: 'INVENTORY',
      price: 50,
      quantity: 1,
      filledQuantity: 0,
      status: 'OPEN',
      expiresAt: null,
      createdAt: null,
    };
    let finish!: (value: boolean) => void;
    const onCancelOrder = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const ui = await render(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, mySellOrders: [sale] }}
        onCancelOrder={onCancelOrder}
      />,
    );
    await fireEvent.press(ui.getByLabelText('판매 취소'));
    await fireEvent.press(ui.getAllByLabelText('판매 취소').at(-1)!);
    await fireEvent.press(ui.getByLabelText('취소 처리 중...'));
    expect(onCancelOrder).toHaveBeenCalledTimes(1);
    await act(async () => finish(true));
    await waitFor(() => expect(ui.queryByText('판매를 취소할까요?')).toBeNull());
  });
  it('취소 도중 이미 종료된 주문이 목록에서 사라지면 확인창도 닫힌다', async () => {
    const sale: MarketOrder = {
      orderId: 81,
      assetId: 1,
      name: '고양이 소파',
      assetKey: null,
      side: 'SELL',
      source: 'INVENTORY',
      price: 50,
      quantity: 1,
      filledQuantity: 0,
      status: 'OPEN',
      expiresAt: null,
      createdAt: null,
    };
    const onCancelOrder = jest.fn().mockResolvedValue(false);
    const ui = await render(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, mySellOrders: [sale] }}
        onCancelOrder={onCancelOrder}
      />,
    );
    await fireEvent.press(ui.getByLabelText('판매 취소'));
    await fireEvent.press(ui.getAllByLabelText('판매 취소').at(-1)!);
    await waitFor(() => expect(onCancelOrder).toHaveBeenCalledTimes(1));
    await ui.rerender(
      <MarketAssetScreen
        asset={{ ...DEMO_MARKET_ASSET, mySellOrders: [] }}
        onCancelOrder={onCancelOrder}
      />,
    );
    expect(ui.queryByText('판매를 취소할까요?')).toBeNull();
    expect(ui.queryByLabelText('판매 취소')).toBeNull();
  });
});
