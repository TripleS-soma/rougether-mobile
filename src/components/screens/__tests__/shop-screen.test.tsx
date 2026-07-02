import { fireEvent, render } from '@testing-library/react-native';

import { ShopScreen } from '@/components/screens/shop-screen';
import { FURNITURE_ITEMS } from '@/resources/furniture';

const bed = FURNITURE_ITEMS.find((f) => f.id === 'bed')!;

describe('ShopScreen', () => {
  it('renders the title and tabs', async () => {
    const { getByText } = await render(<ShopScreen diaBalance={999} />);
    expect(getByText('상점')).toBeTruthy();
    expect(getByText('방 꾸미기')).toBeTruthy();
    expect(getByText('캐릭터 악세서리')).toBeTruthy();
  });

  it('buys an affordable, unowned deco item with dia', async () => {
    const onBuy = jest.fn();
    const { getByLabelText } = await render(<ShopScreen diaBalance={9999} onBuy={onBuy} />);

    await fireEvent.press(getByLabelText(`${bed.name} 구매`));

    expect(onBuy).toHaveBeenCalledWith('bed');
  });

  it('shows owned items as 보유중 (no buy button)', async () => {
    const onBuy = jest.fn();
    const { queryByLabelText } = await render(
      <ShopScreen diaBalance={9999} ownedItemIds={['bed']} onBuy={onBuy} />,
    );
    // Owned → no "구매" affordance for that item.
    expect(queryByLabelText(`${bed.name} 구매`)).toBeNull();
  });

  it('does not buy when dia is insufficient', async () => {
    const onBuy = jest.fn();
    const { getByLabelText } = await render(<ShopScreen diaBalance={0} onBuy={onBuy} />);

    await fireEvent.press(getByLabelText(`${bed.name} 구매`));

    expect(onBuy).not.toHaveBeenCalled();
  });

  it('marks character accessories as gacha-only', async () => {
    const { getByText, getAllByText } = await render(<ShopScreen diaBalance={0} />);
    await fireEvent.press(getByText('캐릭터 악세서리'));
    expect(getByText('캐릭터 악세서리는 뽑기로만 얻을 수 있어요.')).toBeTruthy();
    expect(getAllByText('가챠 전용').length).toBeGreaterThan(0);
  });
});
