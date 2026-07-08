import { fireEvent, render } from '@testing-library/react-native';

import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import type { FurnitureItem, Wallpaper } from '@/resources/furniture';

describe('RoomDecorScreen', () => {
  it('renders the title, category tabs, and a catalog item', async () => {
    const { getByText, getAllByText } = await render(<RoomDecorScreen />);
    expect(getByText('나의 방 꾸미기')).toBeTruthy();
    expect(getByText('가구')).toBeTruthy();
    expect(getAllByText('포근한 침대').length).toBeGreaterThan(0);
  });

  it('filters by categoryCode-derived tabs (가구/장식)', async () => {
    const items: FurnitureItem[] = [
      { id: '1', name: '창문', slot: 'topLeft', category: '장식', price: 100, assetKey: 'a', theme: '숲속 세이지' }, // prettier-ignore
      { id: '2', name: '오븐', slot: 'topRight', category: '가구', price: 100, assetKey: 'b', theme: '작은 베이커리' }, // prettier-ignore
    ];
    const { getByText, queryByText, getAllByText } = await render(
      <RoomDecorScreen furniture={items} wallpapers={[]} />,
    );

    // Item-type tabs from the API categoryCode mapping — no theme tabs.
    expect(getByText('가구')).toBeTruthy();
    expect(queryByText('숲속 세이지')).toBeNull();

    await fireEvent.press(getByText('장식'));
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

    expect(onApply).toHaveBeenCalledWith(['bed', 'plant'], 'paw', null, null);
  });

  it('replaces the item already in a slot (one item per slot)', async () => {
    const onApply = jest.fn();
    const { getByText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} onApply={onApply} />,
    );

    // '한옥 자개 침대' shares the 'bed' slot with '포근한 침대', so it replaces it.
    await fireEvent.press(getByText('한옥 자개 침대'));
    await fireEvent.press(getByText('적용하기'));

    expect(onApply).toHaveBeenCalledWith(['hanok-bed'], 'simple', null, null);
  });

  it('shows 바닥/배경 tabs from the API surface categories and applies the selection', async () => {
    const onApply = jest.fn();
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];
    const backgrounds: Wallpaper[] = [
      { id: 'b1', name: '해변 배경', price: 100, assetKey: 'items/a/bg.png', color: '#DDD' },
    ];
    const { getByText, getAllByText, queryByText } = await render(
      <RoomDecorScreen
        initialPlacedIds={[]}
        floors={floors}
        backgrounds={backgrounds}
        onApply={onApply}
      />,
    );

    // Surface tabs appear only when the catalogue carries those categories.
    // (The tab renders before the section header of the same name.)
    await fireEvent.press(getAllByText('바닥')[0]);
    expect(getAllByText('원목 바닥재').length).toBeGreaterThan(0);
    expect(queryByText('포근한 침대')).toBeNull();
    await fireEvent.press(getAllByText('원목 바닥재')[0]);

    await fireEvent.press(getAllByText('배경')[0]);
    await fireEvent.press(getAllByText('해변 배경')[0]);

    await fireEvent.press(getByText('적용하기'));
    expect(onApply).toHaveBeenCalledWith([], 'simple', 'f1', 'b1');
  });

  it('hides 바닥/배경 tabs when the catalogue has none', async () => {
    const { queryByText } = await render(<RoomDecorScreen />);
    expect(queryByText('바닥')).toBeNull();
    expect(queryByText('배경')).toBeNull();
  });

  it('deselects a floor by tapping it again', async () => {
    const onApply = jest.fn();
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];
    const { getByText, getAllByText } = await render(
      <RoomDecorScreen
        initialPlacedIds={[]}
        initialFloorId="f1"
        floors={floors}
        onApply={onApply}
      />,
    );
    await fireEvent.press(getAllByText('바닥')[0]);
    await fireEvent.press(getAllByText('원목 바닥재')[0]);
    await fireEvent.press(getByText('적용하기'));
    expect(onApply).toHaveBeenCalledWith([], 'simple', null, null);
  });

  it('buys an unowned surface with dia after confirming', async () => {
    const onBuy = jest.fn();
    const onApply = jest.fn();
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen
        initialPlacedIds={[]}
        floors={floors}
        ownedIds={[]}
        diaBalance={500}
        onBuy={onBuy}
        onApply={onApply}
      />,
    );
    // Unowned → the tile opens the 구매 confirm, not a selection or instant buy.
    await fireEvent.press(getByLabelText('원목 바닥재 구매'));
    expect(onBuy).not.toHaveBeenCalled();
    expect(getByText('구매하시겠습니까?')).toBeTruthy();

    await fireEvent.press(getByLabelText('구매 확인'));
    expect(onBuy).toHaveBeenCalledWith('f1');
    await fireEvent.press(getByText('적용하기'));
    expect(onApply).toHaveBeenCalledWith([], 'simple', null, null);
  });

  it('does not buy a surface when dia is insufficient', async () => {
    const onBuy = jest.fn();
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];
    const { getByLabelText } = await render(
      <RoomDecorScreen floors={floors} ownedIds={['bed']} diaBalance={0} onBuy={onBuy} />,
    );
    await fireEvent.press(getByLabelText('원목 바닥재 구매'));
    expect(onBuy).not.toHaveBeenCalled();
  });

  it('buys a not-yet-owned item with dia after confirming', async () => {
    const onBuy = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen ownedIds={['bed']} diaBalance={9999} onBuy={onBuy} />,
    );

    // '초록 식물' is not owned → its tile opens the 구매 confirm.
    await fireEvent.press(getByLabelText('초록 식물 구매'));
    expect(onBuy).not.toHaveBeenCalled();
    expect(getByText(/초록 식물.*구매해요/)).toBeTruthy();

    await fireEvent.press(getByLabelText('구매 확인'));
    expect(onBuy).toHaveBeenCalledWith('plant');
  });

  it('cancels a purchase from the confirm modal', async () => {
    const onBuy = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <RoomDecorScreen ownedIds={['bed']} diaBalance={9999} onBuy={onBuy} />,
    );

    await fireEvent.press(getByLabelText('초록 식물 구매'));
    await fireEvent.press(getByLabelText('구매 취소'));

    expect(onBuy).not.toHaveBeenCalled();
    expect(queryByText('구매하시겠습니까?')).toBeNull();
  });

  it('does not buy when dia is insufficient', async () => {
    const onBuy = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <RoomDecorScreen ownedIds={['bed']} diaBalance={0} onBuy={onBuy} />,
    );

    await fireEvent.press(getByLabelText('초록 식물 구매'));

    // Unaffordable tiles don't even open the confirm.
    expect(queryByText('구매하시겠습니까?')).toBeNull();
    expect(onBuy).not.toHaveBeenCalled();
  });

  it('filters the catalog to owned items with the 보유중 toggle', async () => {
    const { getByLabelText, getAllByText, queryByText } = await render(
      <RoomDecorScreen ownedIds={['bed']} diaBalance={9999} />,
    );

    // Both owned and unowned items show by default.
    expect(getAllByText('포근한 침대').length).toBeGreaterThan(0);
    expect(getByLabelText('초록 식물 구매')).toBeTruthy();

    await fireEvent.press(getByLabelText('보유중만 보기'));
    expect(getAllByText('포근한 침대').length).toBeGreaterThan(0);
    expect(queryByText('초록 식물')).toBeNull();

    // Toggling back restores the shop side.
    await fireEvent.press(getByLabelText('보유중만 보기'));
    expect(getByLabelText('초록 식물 구매')).toBeTruthy();
  });
});
