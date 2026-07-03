import { fireEvent, render } from '@testing-library/react-native';

import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import type { FurnitureItem } from '@/resources/furniture';

describe('RoomDecorScreen', () => {
  it('renders the title, category tabs, and a catalog item', async () => {
    const { getByText, getAllByText } = await render(<RoomDecorScreen />);
    expect(getByText('나의 방 꾸미기')).toBeTruthy();
    expect(getByText('가구')).toBeTruthy();
    expect(getAllByText('포근한 침대').length).toBeGreaterThan(0);
  });

  it('filters by theme tabs when the whole catalogue is themed (API shape)', async () => {
    const themed: FurnitureItem[] = [
      { id: '1', name: '창문', slot: 'topLeft', category: '장식', price: 100, assetKey: 'a', theme: '숲속 세이지' }, // prettier-ignore
      { id: '2', name: '오븐', slot: 'topRight', category: '가구', price: 100, assetKey: 'b', theme: '작은 베이커리' }, // prettier-ignore
    ];
    const { getByText, queryByText, getAllByText } = await render(
      <RoomDecorScreen furniture={themed} wallpapers={[]} />,
    );

    // Theme tabs replace the item-type tabs.
    expect(getByText('숲속 세이지')).toBeTruthy();
    expect(queryByText('가구')).toBeNull();

    await fireEvent.press(getByText('숲속 세이지'));
    expect(getAllByText('창문').length).toBeGreaterThan(0);
    expect(queryByText('오븐')).toBeNull();
  });

  it('applies the current selection on 적용하기', async () => {
    const onApply = jest.fn();
    const { getByText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} initialWallpaperId="paw" onApply={onApply} />,
    );

    // 'plant' occupies a different slot than 'bed', so both stay placed.
    await fireEvent.press(getByText('초록 식물'));
    await fireEvent.press(getByText('적용하기'));

    expect(onApply).toHaveBeenCalledWith(['bed', 'plant'], 'paw');
  });

  it('replaces the item already in a slot (one item per slot)', async () => {
    const onApply = jest.fn();
    const { getByText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} onApply={onApply} />,
    );

    // '한옥 자개 침대' shares the 'bed' slot with '포근한 침대', so it replaces it.
    await fireEvent.press(getByText('한옥 자개 침대'));
    await fireEvent.press(getByText('적용하기'));

    expect(onApply).toHaveBeenCalledWith(['hanok-bed'], 'simple');
  });

  it('buys a not-yet-owned item with dia', async () => {
    const onBuy = jest.fn();
    const { getByLabelText } = await render(
      <RoomDecorScreen ownedIds={['bed']} diaBalance={9999} onBuy={onBuy} />,
    );

    // '초록 식물' is not owned → its tile is a buy affordance.
    await fireEvent.press(getByLabelText('초록 식물 구매'));

    expect(onBuy).toHaveBeenCalledWith('plant');
  });

  it('does not buy when dia is insufficient', async () => {
    const onBuy = jest.fn();
    const { getByLabelText } = await render(
      <RoomDecorScreen ownedIds={['bed']} diaBalance={0} onBuy={onBuy} />,
    );

    await fireEvent.press(getByLabelText('초록 식물 구매'));

    expect(onBuy).not.toHaveBeenCalled();
  });
});
