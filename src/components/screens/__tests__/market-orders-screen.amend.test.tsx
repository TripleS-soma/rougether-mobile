import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { MarketOrder } from '@/api/market';
import { MarketOrdersScreen } from '@/components/screens/market-orders-screen';

const base: MarketOrder = {
  orderId: 1,
  assetId: 9,
  name: '고양이 소파',
  assetKey: null,
  side: 'SELL',
  source: 'ISSUANCE',
  price: 30,
  quantity: 3,
  filledQuantity: 1,
  status: 'OPEN',
  expiresAt: null,
  createdAt: null,
};

describe('MarketOrdersScreen — 판매 수량 수정 (서버 #437)', () => {
  it('대기 중인 발행 재고 판매 주문에만 버튼이 있다', async () => {
    const ui = await render(
      <MarketOrdersScreen
        onAmend={jest.fn()}
        orders={[
          base,
          { ...base, orderId: 2, name: '보유 판매', source: 'INVENTORY' },
          { ...base, orderId: 3, name: '구매', side: 'BUY', source: null },
          { ...base, orderId: 4, name: '끝난 주문', status: 'FILLED' },
        ]}
      />,
    );
    expect(ui.getByLabelText('고양이 소파 판매 수량 수정')).toBeTruthy();
    expect(ui.queryByLabelText('보유 판매 판매 수량 수정')).toBeNull();
    expect(ui.queryByLabelText('구매 판매 수량 수정')).toBeNull();
    expect(ui.queryByLabelText('끝난 주문 판매 수량 수정')).toBeNull();
  });

  it('팔린 수량 이하로는 못 줄이고, 바꾼 수량으로 onAmend → 성공하면 시트를 닫는다', async () => {
    const onAmend = jest.fn(async () => true);
    const ui = await render(<MarketOrdersScreen orders={[base]} onAmend={onAmend} />);
    await fireEvent.press(ui.getByLabelText('고양이 소파 판매 수량 수정'));
    // 3 → 2 → (팔린 1개보다 많아야 하니) 2가 하한.
    await fireEvent.press(ui.getByLabelText('수량 줄이기'));
    expect(ui.getByLabelText('판매 수량 2개')).toBeTruthy();
    expect(ui.getByLabelText('수량 줄이기')).toBeDisabled();
    await fireEvent.press(ui.getByText('바꾸기'));
    expect(onAmend).toHaveBeenCalledWith(1, 2);
    await waitFor(() => expect(ui.queryByText('판매 수량 바꾸기')).toBeNull());
  });

  it('수량을 안 바꾸면 바꾸기 버튼이 꺼져 있다', async () => {
    const ui = await render(<MarketOrdersScreen orders={[base]} onAmend={jest.fn()} />);
    await fireEvent.press(ui.getByLabelText('고양이 소파 판매 수량 수정'));
    expect(ui.getByLabelText('바꾸기')).toBeDisabled();
  });
});
