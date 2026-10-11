import { fireEvent, render } from '@testing-library/react-native';

import { MarketScreen } from '@/components/screens/market-screen';
import { DEMO_MARKET_ASSETS } from '@/mocks/fixtures';

describe('MarketScreen (#1502 — 전체 메뉴의 독립 화면)', () => {
  it('제목·코인·목록을 그리고, 카드를 누르면 그 가구 상세로', async () => {
    const onOpenAsset = jest.fn();
    const ui = await render(
      <MarketScreen assets={DEMO_MARKET_ASSETS} coinBalance={1200} onOpenAsset={onOpenAsset} />,
    );
    expect(ui.getByText('가구 거래소')).toBeTruthy();
    const first = DEMO_MARKET_ASSETS[0];
    await fireEvent.press(ui.getByLabelText(`${first.name} 보기`));
    expect(onOpenAsset).toHaveBeenCalledWith(first.assetId);
  });

  it('판매 중인 내 가구가 있으면 안내 줄 + 내 주문 보기', async () => {
    const onOpenOrders = jest.fn();
    const ui = await render(<MarketScreen sellingCount={2} onOpenOrders={onOpenOrders} />);
    expect(ui.getByText('판매 중인 가구 2개')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('내 주문 보기'));
    expect(onOpenOrders).toHaveBeenCalled();
  });

  it('판매 중인 가구가 없으면 안내 줄이 없다', async () => {
    const ui = await render(<MarketScreen sellingCount={0} />);
    expect(ui.queryByText(/판매 중인 가구/)).toBeNull();
  });

  it('뒤로 버튼은 onBack', async () => {
    const onBack = jest.fn();
    const ui = await render(<MarketScreen onBack={onBack} />);
    await fireEvent.press(ui.getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalled();
  });
});
