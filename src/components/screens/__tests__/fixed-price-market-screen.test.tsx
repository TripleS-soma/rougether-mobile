import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { MarketListing } from '@/api/market-shop';
import {
  FixedPriceListingScreen,
  FixedPriceMarketScreen,
} from '@/components/screens/fixed-price-market-screen';

const item: MarketListing = {
  assetId: 11,
  itemId: 226,
  name: '고양이 소파',
  assetKey: null,
  creatorNickname: '제작자',
  isCreator: false,
  price: 30,
  selling: true,
  owned: false,
};

describe('고정가 거래소', () => {
  it('구매자는 표시 가격만 확인하고 구매하며 가격과 수량을 입력하지 않는다', async () => {
    const buy = jest.fn().mockResolvedValue(true);
    const ui = await render(
      <FixedPriceListingScreen listing={item} coinBalance={100} onBuy={buy} />,
    );
    expect(ui.queryByLabelText('개당 가격 (코인)')).toBeNull();
    expect(ui.queryByLabelText('판매하기')).toBeNull();
    await fireEvent.press(ui.getByLabelText('30코인에 구매하기'));
    expect(buy).not.toHaveBeenCalled();
    expect(ui.getByText(/30코인으로 구매해 가구함에 보관해요/)).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('구매하기'));
    await waitFor(() => expect(buy).toHaveBeenCalledWith(30));
  });

  it('제작자는 원본 보관 안내와 가격 변경, 판매 중지 기능만 본다', async () => {
    const update = jest.fn().mockResolvedValue(true);
    const ui = await render(
      <FixedPriceListingScreen
        listing={{ ...item, isCreator: true, owned: true }}
        coinBalance={0}
        onUpdate={update}
      />,
    );
    expect(ui.getByText(/직접 만든 원본은 계속 보관돼요/)).toBeTruthy();
    expect(ui.queryByLabelText('30코인에 구매하기')).toBeNull();
    expect(ui.queryByLabelText('발행 재고 판매')).toBeNull();
    await fireEvent.changeText(ui.getByLabelText('개당 가격 (코인)'), '45');
    await fireEvent.press(ui.getByLabelText('이 가격으로 판매하기'));
    await waitFor(() => expect(update).toHaveBeenCalledWith(45, true));
    await fireEvent.press(ui.getByLabelText('판매 중지하기'));
    await waitFor(() => expect(update).toHaveBeenCalledWith(30, false));
  });

  it.each([
    { owned: true, selling: true, label: '보유 중' },
    { owned: false, selling: false, label: '판매 중지' },
  ])('이미 보유하거나 판매가 중지되면 구매할 수 없다', async ({ owned, selling, label }) => {
    const ui = await render(
      <FixedPriceListingScreen listing={{ ...item, owned, selling }} coinBalance={100} />,
    );
    expect(ui.getByLabelText(label).props.accessibilityState.disabled).toBe(true);
  });

  it('구매 확인 중 가격이 바뀌어도 확인했던 가격을 요청한다', async () => {
    const buy = jest.fn().mockResolvedValue(false);
    const ui = await render(
      <FixedPriceListingScreen listing={item} coinBalance={100} onBuy={buy} />,
    );
    await fireEvent.press(ui.getByLabelText('30코인에 구매하기'));
    await ui.rerender(
      <FixedPriceListingScreen listing={{ ...item, price: 50 }} coinBalance={100} onBuy={buy} />,
    );
    await fireEvent.press(ui.getByLabelText('구매하기'));
    await waitFor(() => expect(buy).toHaveBeenCalledWith(30));
    await waitFor(() => expect(ui.queryByText('이 가구를 구매할까요?')).toBeNull());
    expect(ui.getByLabelText('50코인에 구매하기')).toBeTruthy();
  });

  it('목록은 판매 가격을 보여주고 주문 대기나 수량을 표시하지 않는다', async () => {
    const open = jest.fn();
    const ui = await render(<FixedPriceMarketScreen listings={[item]} onOpen={open} />);
    expect(ui.getByText('30코인')).toBeTruthy();
    expect(ui.queryByText('내 주문')).toBeNull();
    await fireEvent.press(ui.getByLabelText('가구 보기'));
    expect(open).toHaveBeenCalledWith(11);
  });
});
