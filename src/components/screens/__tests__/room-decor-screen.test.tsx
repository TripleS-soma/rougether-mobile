import { fireEvent, render } from '@testing-library/react-native';

import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { ToastProvider } from '@/components/ui/toast';
import type { Wallpaper } from '@/resources/furniture';

// Local demo catalog anchors: 'bed'(포근한 침대, 아래 왼쪽) shares its slot with
// 'hanok-bed'(한옥 자개 침대); 'plant'(초록 식물) sits in 중간 왼쪽; default
// wallpaper id 'simple', alternative 'paw'(발자국 패턴).
describe('RoomDecorScreen (#243 — 방을 직접 탭해서 꾸미기)', () => {
  it('renders the title, the touch guide, and no positional filter chips', async () => {
    const { getByText, queryByText } = await render(<RoomDecorScreen />);
    expect(getByText('나의 방 꾸미기')).toBeTruthy();
    expect(getByText('방을 눌러 꾸며보세요')).toBeTruthy();
    // Slot jargon lives in a11y labels only — no visible chips.
    expect(queryByText('위 왼쪽')).toBeNull();
  });

  it('opens the slot picker from an empty slot and places an item', async () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('중간 왼쪽 자리 비어 있음'));
    expect(getByText('이 자리에 놓을 가구')).toBeTruthy();
    // Only this slot's items are offered — other slots' items stay out.
    expect(getByText('초록 식물')).toBeTruthy();
    expect(queryByText('햇살 창문')).toBeNull();

    await fireEvent.press(getByText('초록 식물'));
    await fireEvent.press(getByText('적용하기'));
    expect(onApply).toHaveBeenCalledWith(['bed', 'plant'], 'simple', null, null);
  });

  it('replaces the item already in a slot from the filled-slot picker', async () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('아래 왼쪽 자리 — 포근한 침대'));
    await fireEvent.press(getByText('한옥 자개 침대'));
    await fireEvent.press(getByText('적용하기'));
    expect(onApply).toHaveBeenCalledWith(['hanok-bed'], 'simple', null, null);
  });

  it('clears a slot via 비우기', async () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('아래 왼쪽 자리 — 포근한 침대'));
    await fireEvent.press(getByLabelText('비우기'));
    await fireEvent.press(getByText('적용하기'));
    expect(onApply).toHaveBeenCalledWith([], 'simple', null, null);
  });

  it('picks a wallpaper by tapping the wall', async () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialPlacedIds={[]} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('벽 꾸미기'));
    await fireEvent.press(getByText('발자국 패턴'));
    await fireEvent.press(getByText('적용하기'));
    expect(onApply).toHaveBeenCalledWith([], 'paw', null, null);
  });

  it('offers 배경/바닥 segments only when the catalogue has them', async () => {
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];
    const backgrounds: Wallpaper[] = [
      { id: 'b1', name: '해변 배경', price: 100, assetKey: 'items/a/bg.png', color: '#DDD' },
    ];

    const bare = await render(<RoomDecorScreen initialPlacedIds={[]} />);
    await fireEvent.press(bare.getByLabelText('벽 꾸미기'));
    expect(bare.queryByText('배경')).toBeNull();
    expect(bare.queryByText('바닥')).toBeNull();

    const full = await render(
      <RoomDecorScreen initialPlacedIds={[]} floors={floors} backgrounds={backgrounds} />,
    );
    await fireEvent.press(full.getByLabelText('벽 꾸미기'));
    expect(full.getByText('배경')).toBeTruthy();
    expect(full.getByText('바닥')).toBeTruthy();
  });

  it('selects floor and background through the surface segments', async () => {
    const onApply = jest.fn();
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];
    const backgrounds: Wallpaper[] = [
      { id: 'b1', name: '해변 배경', price: 100, assetKey: 'items/a/bg.png', color: '#DDD' },
    ];
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen
        initialPlacedIds={[]}
        floors={floors}
        backgrounds={backgrounds}
        onApply={onApply}
      />,
    );

    await fireEvent.press(getByLabelText('바닥 꾸미기'));
    await fireEvent.press(getByText('원목 바닥재'));
    await fireEvent.press(getByText('배경'));
    await fireEvent.press(getByText('해변 배경'));
    await fireEvent.press(getByText('적용하기'));
    expect(onApply).toHaveBeenCalledWith([], 'simple', 'f1', 'b1');
  });

  it('clears an applied floor via 비우기', async () => {
    const onApply = jest.fn();
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen
        initialPlacedIds={[]}
        initialFloorId="f1"
        floors={floors}
        onApply={onApply}
      />,
    );

    await fireEvent.press(getByLabelText('바닥 꾸미기'));
    await fireEvent.press(getByLabelText('비우기'));
    await fireEvent.press(getByText('적용하기'));
    expect(onApply).toHaveBeenCalledWith([], 'simple', null, null);
  });

  it('closes the picker with 선택 닫기 and shows the guide again', async () => {
    const { getByText, getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} />,
    );

    await fireEvent.press(getByLabelText('중간 왼쪽 자리 비어 있음'));
    expect(queryByText('방을 눌러 꾸며보세요')).toBeNull();
    await fireEvent.press(getByLabelText('선택 닫기'));
    expect(getByText('방을 눌러 꾸며보세요')).toBeTruthy();
  });

  it('buys a not-yet-owned item with dia after confirming', async () => {
    const onBuy = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialPlacedIds={[]} ownedIds={['bed']} diaBalance={9999} onBuy={onBuy} />,
    );

    await fireEvent.press(getByLabelText('중간 왼쪽 자리 비어 있음'));
    await fireEvent.press(getByLabelText('초록 식물 구매'));
    expect(onBuy).not.toHaveBeenCalled();
    expect(getByText(/초록 식물.*구매해요/)).toBeTruthy();

    await fireEvent.press(getByLabelText('구매 확인'));
    expect(onBuy).toHaveBeenCalledWith('plant');
  });

  it('cancels a purchase from the confirm modal', async () => {
    const onBuy = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialPlacedIds={[]} ownedIds={['bed']} diaBalance={9999} onBuy={onBuy} />,
    );

    await fireEvent.press(getByLabelText('중간 왼쪽 자리 비어 있음'));
    await fireEvent.press(getByLabelText('초록 식물 구매'));
    await fireEvent.press(getByLabelText('구매 취소'));

    expect(onBuy).not.toHaveBeenCalled();
    expect(queryByText('구매하시겠습니까?')).toBeNull();
  });

  it('explains an unaffordable tile with a toast instead of the buy confirm', async () => {
    const onBuy = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <ToastProvider>
        <RoomDecorScreen initialPlacedIds={[]} ownedIds={['bed']} diaBalance={0} onBuy={onBuy} />
      </ToastProvider>,
    );

    await fireEvent.press(getByLabelText('중간 왼쪽 자리 비어 있음'));
    await fireEvent.press(getByLabelText('초록 식물 구매'));

    expect(queryByText('구매하시겠습니까?')).toBeNull();
    expect(getByText('다이아가 부족해요')).toBeTruthy();
    expect(onBuy).not.toHaveBeenCalled();
  });

  it('goes straight back when nothing changed', async () => {
    const onBack = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} onBack={onBack} />,
    );

    await fireEvent.press(getByLabelText('뒤로가기'));

    expect(queryByText('변경사항을 저장할까요?')).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('asks to save unapplied changes on back, and saves when confirmed', async () => {
    const onBack = jest.fn();
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen
        initialPlacedIds={['bed']}
        initialWallpaperId="paw"
        onBack={onBack}
        onApply={onApply}
      />,
    );

    await fireEvent.press(getByLabelText('중간 왼쪽 자리 비어 있음'));
    await fireEvent.press(getByText('초록 식물'));
    await fireEvent.press(getByLabelText('뒤로가기'));

    expect(getByText('변경사항을 저장할까요?')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('저장하고 나가기'));
    expect(onApply).toHaveBeenCalledWith(['bed', 'plant'], 'paw', null, null);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('discards changes when leaving without saving', async () => {
    const onBack = jest.fn();
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} onBack={onBack} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('중간 왼쪽 자리 비어 있음'));
    await fireEvent.press(getByText('초록 식물'));
    await fireEvent.press(getByLabelText('뒤로가기'));
    await fireEvent.press(getByLabelText('저장하지 않고 나가기'));

    expect(onApply).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('stays on the screen via 계속 꾸미기', async () => {
    const onBack = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialPlacedIds={['bed']} onBack={onBack} />,
    );

    await fireEvent.press(getByLabelText('중간 왼쪽 자리 비어 있음'));
    await fireEvent.press(getByText('초록 식물'));
    await fireEvent.press(getByLabelText('뒤로가기'));
    await fireEvent.press(getByLabelText('계속 꾸미기'));

    expect(queryByText('변경사항을 저장할까요?')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
  });
});
