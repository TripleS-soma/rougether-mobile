import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { ToastProvider } from '@/components/ui/toast';
import {
  FURNITURE_ITEMS,
  slotIdsToPlacements,
  type PlacedFurniture,
  type Wallpaper,
} from '@/resources/furniture';

// Local demo catalog anchors: 'bed'(포근한 침대) / 'plant'(초록 식물) /
// default wallpaper 'simple', alternative 'paw'(발자국 패턴).
const items = (ids: string[]) => slotIdsToPlacements(ids, FURNITURE_ITEMS);
const firstArgIds = (fn: jest.Mock) =>
  (fn.mock.calls[0][0] as PlacedFurniture[]).map((p) => p.furnitureId);

describe('RoomDecorScreen (#327 — 자유 배치)', () => {
  it('renders the title and the drag guide; slot pickers are gone', async () => {
    const { getByText, queryByText, queryByLabelText } = await render(<RoomDecorScreen />);
    expect(getByText('나의 방 꾸미기')).toBeTruthy();
    expect(getByText('가구를 끌어서 꾸며보세요')).toBeTruthy();
    // 슬롯 픽커(빈 자리 + 마커)는 자유 배치에서 사라진다.
    expect(queryByLabelText('중간 왼쪽 자리 비어 있음')).toBeNull();
    expect(queryByText('위 왼쪽')).toBeNull();
  });

  it('adds an item to the room center from 전체보기 and applies', async () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    await fireEvent.press(getByText('초록 식물'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    // 방 가운데(0.5, 0.55)에 최상위 z로 추가된다.
    expect(onApply.mock.calls[0][0]).toEqual([
      expect.objectContaining({ furnitureId: 'plant', x: 0.5, y: 0.55, z: 1 }),
    ]);
    expect(onApply.mock.calls[0].slice(1)).toEqual(['simple', null, null]);
  });

  it('toggles a placed item off in the full catalog', async () => {
    const onApply = jest.fn();
    const { getAllByText, getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    // The name renders in the room preview too — the catalog tile comes last.
    const tiles = getAllByText('초록 식물');
    await fireEvent.press(tiles[tiles.length - 1]);
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(firstArgIds(onApply)).toEqual([]);
  });

  it('picks a wallpaper by tapping the wall', async () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('벽 꾸미기'));
    await fireEvent.press(getByText('발자국 패턴'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith([], 'paw', null, null));
  });

  it('offers 배경/바닥 segments only when the catalogue has them', async () => {
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];
    const backgrounds: Wallpaper[] = [
      { id: 'b1', name: '해변 배경', price: 100, assetKey: 'items/a/bg.png', color: '#DDD' },
    ];

    const bare = await render(<RoomDecorScreen initialItems={[]} />);
    await fireEvent.press(bare.getByLabelText('벽 꾸미기'));
    expect(bare.queryByText('배경')).toBeNull();
    expect(bare.queryByText('바닥')).toBeNull();

    const full = await render(
      <RoomDecorScreen initialItems={[]} floors={floors} backgrounds={backgrounds} />,
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
        initialItems={[]}
        freeLayout
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
    await waitFor(() => expect(onApply).toHaveBeenCalledWith([], 'simple', 'f1', 'b1'));
  });

  it('clears an applied floor via 비우기', async () => {
    const onApply = jest.fn();
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen
        initialItems={[]}
        freeLayout
        initialFloorId="f1"
        floors={floors}
        onApply={onApply}
      />,
    );

    await fireEvent.press(getByLabelText('바닥 꾸미기'));
    await fireEvent.press(getByLabelText('비우기'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith([], 'simple', null, null));
  });

  it('closes the picker with 선택 닫기 and shows the guide again', async () => {
    const { getByText, getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialItems={items(['bed'])} />,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    expect(queryByText('가구를 끌어서 꾸며보세요')).toBeNull();
    await fireEvent.press(getByLabelText('선택 닫기'));
    expect(getByText('가구를 끌어서 꾸며보세요')).toBeTruthy();
  });
});

describe('RoomDecorScreen — 구매', () => {
  it('buys a not-yet-owned item with dia after confirming', async () => {
    const onBuy = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} ownedIds={['bed']} diaBalance={9999} onBuy={onBuy} />,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    await fireEvent.press(getByLabelText('초록 식물 구매'));
    expect(onBuy).not.toHaveBeenCalled();
    expect(getByText(/초록 식물.*구매해요/)).toBeTruthy();

    await fireEvent.press(getByLabelText('구매 확인'));
    expect(onBuy).toHaveBeenCalledWith('plant');
  });

  it('cancels a purchase from the confirm modal', async () => {
    const onBuy = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialItems={[]} ownedIds={['bed']} diaBalance={9999} onBuy={onBuy} />,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    await fireEvent.press(getByLabelText('초록 식물 구매'));
    await fireEvent.press(getByLabelText('구매 취소'));

    expect(onBuy).not.toHaveBeenCalled();
    expect(queryByText('구매하시겠습니까?')).toBeNull();
  });

  it('explains an unaffordable tile with a toast instead of the buy confirm', async () => {
    const onBuy = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <ToastProvider>
        <RoomDecorScreen initialItems={[]} ownedIds={['bed']} diaBalance={0} onBuy={onBuy} />
      </ToastProvider>,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    await fireEvent.press(getByLabelText('초록 식물 구매'));

    expect(queryByText('구매하시겠습니까?')).toBeNull();
    expect(getByText('다이아가 부족해요')).toBeTruthy();
    expect(onBuy).not.toHaveBeenCalled();
  });
});

describe('RoomDecorScreen — 저장 흐름', () => {
  it('첫 자유 배치 저장은 전환 확인 모달을 거친다 (#327)', async () => {
    const onApply = jest.fn();
    const onBack = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={items(['bed'])} onApply={onApply} onBack={onBack} />,
    );

    await fireEvent.press(getByText('적용하기'));
    expect(getByText('새 꾸미기 방식으로 전환할까요?')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('전환하고 저장'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    await waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  it('이미 FREE_V1이면 전환 모달 없이 바로 저장한다', async () => {
    const onApply = jest.fn();
    const { getByText, queryByText } = await render(
      <RoomDecorScreen initialItems={items(['bed'])} freeLayout onApply={onApply} />,
    );

    await fireEvent.press(getByText('적용하기'));
    expect(queryByText('새 꾸미기 방식으로 전환할까요?')).toBeNull();
    await waitFor(() => expect(onApply).toHaveBeenCalled());
  });

  it('리비전 충돌(409)이면 재로드 모달 → 새로 불러오기 (#327)', async () => {
    const onApply = jest.fn(async () => 'conflict' as const);
    const onConflictReload = jest.fn();
    const onBack = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen
        initialItems={items(['bed'])}
        freeLayout
        onApply={onApply}
        onConflictReload={onConflictReload}
        onBack={onBack}
      />,
    );

    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(getByText('다른 기기에서 먼저 저장했어요')).toBeTruthy());
    expect(onBack).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('새로 불러오기'));
    expect(onConflictReload).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  it('goes straight back when nothing changed', async () => {
    const onBack = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialItems={items(['bed'])} onBack={onBack} />,
    );

    await fireEvent.press(getByLabelText('뒤로가기'));

    expect(queryByText('변경사항을 저장할까요?')).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('asks to save unapplied changes on back, and saves when confirmed', async () => {
    const onBack = jest.fn();
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout onBack={onBack} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    await fireEvent.press(getByText('초록 식물'));
    await fireEvent.press(getByLabelText('뒤로가기'));

    expect(getByText('변경사항을 저장할까요?')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('저장하고 나가기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(firstArgIds(onApply)).toEqual(['plant']);
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it('discards changes when leaving without saving', async () => {
    const onBack = jest.fn();
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout onBack={onBack} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    await fireEvent.press(getByText('초록 식물'));
    await fireEvent.press(getByLabelText('뒤로가기'));
    await fireEvent.press(getByLabelText('저장하지 않고 나가기'));

    expect(onApply).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('stays on the screen via 계속 꾸미기', async () => {
    const onBack = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout onBack={onBack} />,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    await fireEvent.press(getByText('초록 식물'));
    await fireEvent.press(getByLabelText('뒤로가기'));
    await fireEvent.press(getByLabelText('계속 꾸미기'));

    expect(queryByText('변경사항을 저장할까요?')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
  });
});

describe('RoomDecorScreen — 보유중 필터', () => {
  it('hides the shop side of the picker with the 보유중 toggle', async () => {
    const { getByText, getByLabelText, queryByText, queryByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} ownedIds={['bed']} diaBalance={9999} />,
    );

    await fireEvent.press(getByLabelText('전체보기'));
    // Both sides show by default: owned bed and buyable plant.
    expect(getByText('포근한 침대')).toBeTruthy();
    expect(getByLabelText('초록 식물 구매')).toBeTruthy();

    await fireEvent.press(getByLabelText('보유중만 보기'));
    expect(getByText('포근한 침대')).toBeTruthy();
    expect(queryByText('초록 식물')).toBeNull();

    // Toggling back restores the shop side.
    await fireEvent.press(getByLabelText('보유중만 보기'));
    expect(queryByLabelText('초록 식물 구매')).toBeTruthy();
  });
});
