import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

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

// 드래그 오버레이는 캔버스 onLayout으로 크기를 알아야 렌더된다 — 테스트에서
// 레이아웃 이벤트를 직접 쏴 320px 정사각을 흉내낸다. (await로 상태 플러시)
const layoutCanvas = (getByTestId: (id: string) => unknown) =>
  fireEvent(getByTestId('decor-canvas') as never, 'layout', {
    nativeEvent: { layout: { width: 320, height: 320 } },
  });

/** 가구 탭 제스처(선택)를 성공 상태로 발사한다. */
const tapItem = (id: string) =>
  act(() =>
    fireGestureHandler(getByGestureTestId(`item-tap-${id}`), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ]),
  );

const lastApply = (fn: jest.Mock) =>
  fn.mock.calls[fn.mock.calls.length - 1][0] as PlacedFurniture[];

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

describe('RoomDecorScreen — 선택 · 편집 툴바 (#333)', () => {
  it('tapping an item selects it: ring + toolbar appear, empty-canvas tap deselects', async () => {
    const { getByTestId, getByLabelText, queryByLabelText, queryByTestId } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout />,
    );
    await layoutCanvas(getByTestId);

    expect(queryByLabelText('회전')).toBeNull();
    await tapItem('plant');
    expect(getByTestId('selection-ring-plant')).toBeTruthy();
    expect(getByLabelText('회전')).toBeTruthy();
    expect(getByLabelText('좌우 반전')).toBeTruthy();
    expect(getByLabelText('앞으로')).toBeTruthy();
    expect(getByLabelText('뒤로')).toBeTruthy();
    expect(getByLabelText('빼기')).toBeTruthy();

    await fireEvent.press(getByLabelText('선택 해제'));
    expect(queryByTestId('selection-ring-plant')).toBeNull();
    expect(queryByLabelText('회전')).toBeNull();
  });

  it('회전 rotates in 15° steps; 좌우 반전 toggles the flip', async () => {
    const onApply = jest.fn();
    const { getByTestId, getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />,
    );
    await layoutCanvas(getByTestId);
    await tapItem('plant');

    await fireEvent.press(getByLabelText('회전'));
    await fireEvent.press(getByLabelText('회전'));
    await fireEvent.press(getByLabelText('좌우 반전'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(lastApply(onApply)[0]).toEqual(
      expect.objectContaining({ furnitureId: 'plant', rotationDeg: 30, flipped: true }),
    );

    // 반전을 한 번 더 누르면 원래 방향으로 돌아온다.
    await fireEvent.press(getByLabelText('좌우 반전'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
    expect(lastApply(onApply)[0]).toEqual(
      expect.objectContaining({ rotationDeg: 30, flipped: false }),
    );
  });

  it('앞으로/뒤로 swaps z with the neighbor in stacking order', async () => {
    const onApply = jest.fn();
    // bed z=1(뒤), plant z=2(앞).
    const { getByTestId, getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={items(['bed', 'plant'])} freeLayout onApply={onApply} />,
    );
    await layoutCanvas(getByTestId);
    await tapItem('bed');

    await fireEvent.press(getByLabelText('앞으로'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    const zOf = (id: string) => lastApply(onApply).find((p) => p.furnitureId === id)?.z;
    expect(zOf('bed')).toBe(2);
    expect(zOf('plant')).toBe(1);

    // 이미 맨 앞이면 앞으로는 아무 것도 바꾸지 않는다.
    await fireEvent.press(getByLabelText('앞으로'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
    expect(zOf('bed')).toBe(2);

    await fireEvent.press(getByLabelText('뒤로'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(3));
    expect(zOf('bed')).toBe(1);
    expect(zOf('plant')).toBe(2);
  });

  it('빼기 removes the selected item and closes the toolbar', async () => {
    const onApply = jest.fn();
    const { getByTestId, getByText, getByLabelText, queryByLabelText } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />,
    );
    await layoutCanvas(getByTestId);
    await tapItem('plant');

    await fireEvent.press(getByLabelText('빼기'));
    expect(queryByLabelText('회전')).toBeNull();
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(firstArgIds(onApply)).toEqual([]);
  });

  it('pinch scale commits clamped to 0.5–2.0', async () => {
    const onApply = jest.fn();
    const { getByTestId, getByText } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />,
    );
    await layoutCanvas(getByTestId);

    await act(() =>
      fireGestureHandler(getByGestureTestId('item-pinch-plant'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.ACTIVE, scale: 5 },
        { state: State.END, scale: 5 },
      ]),
    );
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(lastApply(onApply)[0]).toEqual(expect.objectContaining({ scale: 2 }));

    await act(() =>
      fireGestureHandler(getByGestureTestId('item-pinch-plant'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.ACTIVE, scale: 0.01 },
        { state: State.END, scale: 0.01 },
      ]),
    );
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
    expect(lastApply(onApply)[0]).toEqual(expect.objectContaining({ scale: 0.5 }));
  });

  it('resize handle drag commits a new scale', async () => {
    const onApply = jest.fn();
    const { getByTestId, getByText } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />,
    );
    await layoutCanvas(getByTestId);
    await tapItem('plant');

    // itemW = 320 * 0.28 = 89.6px; (45+45)/89.6 ≈ +1.0 → scale ≈ 2 (클램프 상한).
    await act(() =>
      fireGestureHandler(getByGestureTestId('item-handle-plant'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.ACTIVE, translationX: 45, translationY: 45 },
        { state: State.END, translationX: 45, translationY: 45 },
      ]),
    );
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(lastApply(onApply)[0]).toEqual(expect.objectContaining({ scale: 2 }));
  });

  it('dragging out removes the item and clears its selection', async () => {
    const onApply = jest.fn();
    const { getByTestId, getByText, queryByLabelText } = await render(
      <ToastProvider>
        <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />
      </ToastProvider>,
    );
    await layoutCanvas(getByTestId);
    await tapItem('plant');

    // plant 중심(0.5, 0.52·SLOT 기준)에서 오른쪽으로 캔버스 폭만큼 — 방 밖.
    await act(() =>
      fireGestureHandler(getByGestureTestId('item-pan-plant'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.ACTIVE, translationX: 400, translationY: 0 },
        { state: State.END, translationX: 400, translationY: 0 },
      ]),
    );
    await waitFor(() => expect(getByText('가구를 뺐어요')).toBeTruthy());
    expect(queryByLabelText('회전')).toBeNull();
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(firstArgIds(onApply)).toEqual([]);
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
