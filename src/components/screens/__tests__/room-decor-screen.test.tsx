import { fireEvent, render } from '@testing-library/react-native';

import { RoomDecorScreen } from '@/components/screens/room-decor-screen';

describe('RoomDecorScreen', () => {
  it('renders the title, category tabs, and a catalog item', async () => {
    const { getByText, getAllByText } = await render(<RoomDecorScreen />);
    expect(getByText('나의 방 꾸미기')).toBeTruthy();
    expect(getByText('가구')).toBeTruthy();
    expect(getAllByText('포근한 침대').length).toBeGreaterThan(0);
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
