import { fireEvent, render } from '@testing-library/react-native';

import { FurnitureGrid, SwatchGrid } from '@/components/screens/decor/decor-grid';
import { Themes } from '@/constants/theme';
import { FURNITURE_ITEMS, WALLPAPERS } from '@/resources/furniture';

const t = Themes.cozy;
const noop = () => {};

describe('SwatchGrid', () => {
  const wp = WALLPAPERS[0];
  const base = {
    items: [wp],
    selectedId: null,
    onSelect: noop,
    owned: new Set<string>(),
    diamondBalance: 0,
    onBuyRequest: noop,
    onBlockedBuy: noop,
    t,
  };

  it('owned swatch selects on tap and shows 보유', async () => {
    const onSelect = jest.fn();
    const { getByLabelText, getByText } = await render(
      <SwatchGrid {...base} owned={new Set([wp.id])} onSelect={onSelect} />,
    );
    await fireEvent.press(getByLabelText(wp.name));
    expect(onSelect).toHaveBeenCalledWith(wp.id);
    expect(getByText('보유')).toBeTruthy();
  });

  it('unowned swatch previews first, then re-tap buys when affordable', async () => {
    const onSelect = jest.fn();
    const onBuyRequest = jest.fn();
    const first = await render(
      <SwatchGrid {...base} onSelect={onSelect} onBuyRequest={onBuyRequest} />,
    );
    await fireEvent.press(first.getByLabelText(`${wp.name} 미리 적용`));
    expect(onSelect).toHaveBeenCalledWith(wp.id);
    expect(onBuyRequest).not.toHaveBeenCalled();

    const active = await render(
      <SwatchGrid
        {...base}
        selectedId={wp.id}
        diamondBalance={wp.price}
        onBuyRequest={onBuyRequest}
      />,
    );
    await fireEvent.press(active.getByLabelText(`${wp.name} 구매`));
    expect(onBuyRequest).toHaveBeenCalledWith({ id: wp.id, name: wp.name, price: wp.price });
  });

  it('unaffordable re-tap reports a blocked buy instead of a request', async () => {
    const onBuyRequest = jest.fn();
    const onBlockedBuy = jest.fn();
    const { getByLabelText } = await render(
      <SwatchGrid
        {...base}
        selectedId={wp.id}
        diamondBalance={wp.price - 1}
        onBuyRequest={onBuyRequest}
        onBlockedBuy={onBlockedBuy}
      />,
    );
    await fireEvent.press(getByLabelText(`${wp.name} 구매`));
    expect(onBlockedBuy).toHaveBeenCalledTimes(1);
    expect(onBuyRequest).not.toHaveBeenCalled();
  });

  it('renders the 비우기 tile only when onClear is given', async () => {
    const onClear = jest.fn();
    const without = await render(<SwatchGrid {...base} />);
    expect(without.queryByLabelText('비우기')).toBeNull();

    const withClear = await render(<SwatchGrid {...base} onClear={onClear} />);
    await fireEvent.press(withClear.getByLabelText('비우기'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('FurnitureGrid', () => {
  const item = FURNITURE_ITEMS[0];

  it('shows the empty message when there is nothing to place', async () => {
    const { getByText } = await render(
      <FurnitureGrid items={[]} placed={new Set()} onPlace={noop} owned={new Set()} t={t} />,
    );
    expect(getByText('이 자리에 놓을 수 있는 가구가 아직 없어요.')).toBeTruthy();
  });

  it('marks placed tiles selected, labels unowned as 미리 배치, and badges NEW', async () => {
    const onPlace = jest.fn();
    const { getByLabelText, getByTestId } = await render(
      <FurnitureGrid
        items={[item]}
        placed={new Set([item.id])}
        onPlace={onPlace}
        owned={new Set()}
        highlighted={new Set([item.id])}
        t={t}
      />,
    );
    const tile = getByLabelText(`${item.name} 미리 배치`);
    expect(tile.props.accessibilityState.selected).toBe(true);
    expect(getByTestId(`new-badge-${item.id}`)).toBeTruthy();
    await fireEvent.press(tile);
    expect(onPlace).toHaveBeenCalledWith(item);
  });

  it('widens tiles past 4 columns once the grid measures wide (#725)', async () => {
    const { getByTestId, getByLabelText } = await render(
      <FurnitureGrid
        items={[item]}
        placed={new Set()}
        onPlace={noop}
        owned={new Set([item.id])}
        t={t}
      />,
    );
    await fireEvent(getByTestId('decor-grid'), 'layout', {
      nativeEvent: { layout: { width: 800, height: 0 } },
    });
    const flat = Object.assign({}, ...[getByLabelText(item.name).props.style].flat(Infinity));
    // 800px fits 8 columns of 72px + 8px gaps → (800 - 7*8) / 8.
    expect(flat.flexBasis).toBe(93);
  });
});
