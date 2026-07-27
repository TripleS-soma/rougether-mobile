import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
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
  it('renders the title with the furniture panel open by default (#487)', async () => {
    const { getByText, getByLabelText, queryByText, queryByLabelText } = await render(
      <RoomDecorScreen />,
    );
    expect(getByText('나의 방 꾸미기')).toBeTruthy();
    // 전체보기 버튼/가이드 카드 없이 진입 즉시 가구·소품 탭이 열려 있다.
    expect(getByLabelText('가구 탭')).toBeTruthy();
    expect(queryByLabelText('전체보기')).toBeNull();
    expect(queryByText('가구를 끌어서 꾸며보세요')).toBeNull();
    // 슬롯 픽커(빈 자리 + 마커)는 자유 배치에서 사라진다.
    expect(queryByLabelText('중간 왼쪽 자리 비어 있음')).toBeNull();
    expect(queryByText('위 왼쪽')).toBeNull();
  });

  it('adds an item to the room center from 전체보기 and applies', async () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('소품 탭')); // 장식류는 소품 탭 (#488)
    await fireEvent.press(getByLabelText('초록 식물'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    // 방 가운데(0.5, 0.55)에 최상위 z로 추가된다.
    expect(onApply.mock.calls[0][0]).toEqual([
      expect.objectContaining({ furnitureId: 'plant', x: 0.5, y: 0.55, z: 1 }),
    ]);
    expect(onApply.mock.calls[0].slice(1)).toEqual(['simple', null, null]);
  });

  it('snapshots item render defaults only when a new FREE_V1 item is placed', async () => {
    const onApply = jest.fn();
    const furniture = [
      {
        ...FURNITURE_ITEMS[0],
        id: 'scale-reference',
        name: '기준 램프',
        defaultScale: 1.24,
        defaultPositionX: 0.35,
        defaultPositionY: 0.65,
      },
    ];
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout furniture={furniture} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('기준 램프'));
    await fireEvent.press(getByText('적용하기'));

    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(onApply.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        furnitureId: 'scale-reference',
        scale: 1.24,
        x: 0.35,
        y: 0.65,
      }),
    ]);
  });

  it('uses the shared center when either item default coordinate is missing', async () => {
    const onApply = jest.fn();
    const furniture = [
      {
        ...FURNITURE_ITEMS[0],
        id: 'partial-position',
        name: '좌표 한쪽만 있는 램프',
        defaultPositionX: 0.2,
        defaultPositionY: undefined,
      },
    ];
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout furniture={furniture} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('좌표 한쪽만 있는 램프'));
    await fireEvent.press(getByText('적용하기'));

    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(onApply.mock.calls[0][0]).toEqual([
      expect.objectContaining({ furnitureId: 'partial-position', x: 0.5, y: 0.55 }),
    ]);
  });

  it('clamps a large item default position inside the room', async () => {
    const onApply = jest.fn();
    const furniture = [
      {
        ...FURNITURE_ITEMS[0],
        id: 'edge-position',
        name: '가장자리 큰 램프',
        defaultScale: 2,
        defaultPositionX: 0,
        defaultPositionY: 1,
      },
    ];
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout furniture={furniture} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('가장자리 큰 램프'));
    await fireEvent.press(getByText('적용하기'));

    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(onApply.mock.calls[0][0]).toEqual([
      expect.objectContaining({ furnitureId: 'edge-position', scale: 2, x: 0.28, y: 0.72 }),
    ]);
  });

  it('keeps an existing placement scale instead of reapplying the catalogue default', async () => {
    const onApply = jest.fn();
    const furniture = [
      {
        ...FURNITURE_ITEMS[0],
        id: 'scale-reference',
        name: '기준 램프',
        defaultScale: 1.24,
        defaultPositionX: 0.2,
        defaultPositionY: 0.8,
      },
    ];
    const existing: PlacedFurniture = {
      furnitureId: 'scale-reference',
      x: 0.4,
      y: 0.6,
      z: 1,
      scale: 0.8,
    };
    const { getByText } = await render(
      <RoomDecorScreen
        initialItems={[existing]}
        freeLayout
        furniture={furniture}
        onApply={onApply}
      />,
    );

    await fireEvent.press(getByText('적용하기'));

    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(onApply.mock.calls[0][0]).toEqual([existing]);
  });

  it('toggles a placed item off in the full catalog', async () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />,
    );

    // 타일 이름 텍스트는 사라졌다 (#487) — 카탈로그 타일은 접근성 라벨로 누른다.
    await fireEvent.press(getByLabelText('소품 탭')); // 장식류는 소품 탭 (#488)
    await fireEvent.press(getByLabelText('초록 식물'));
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
    await fireEvent.press(getByLabelText('발자국 패턴'));
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
    await fireEvent.press(getByLabelText('원목 바닥재'));
    await fireEvent.press(getByText('배경'));
    await fireEvent.press(getByLabelText('해변 배경'));
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

  it('서브픽커의 선택 닫기는 전체 패널로 복귀한다 (#487)', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <RoomDecorScreen initialItems={items(['bed'])} freeLayout />,
    );

    // 기본 'all' 패널에는 닫기 버튼이 없다 — 닫을 곳이 없는 기본 상태.
    expect(queryByLabelText('선택 닫기')).toBeNull();
    // 벽 탭 → 벽지 서브픽커(닫기 있음) → 닫으면 다시 전체 패널.
    await fireEvent.press(getByLabelText('벽 꾸미기'));
    await fireEvent.press(getByLabelText('선택 닫기'));
    expect(getByLabelText('가구 탭')).toBeTruthy();
    expect(queryByLabelText('선택 닫기')).toBeNull();
  });
});

describe('RoomDecorScreen — 안드로이드 하드웨어 백 (#488)', () => {
  it('서브픽커는 all로 복귀, all에선 폴스루, dirty면 나가기 확인', async () => {
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    const { getByLabelText, getByText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout />,
    );
    const lastHandler = () =>
      spy.mock.calls[spy.mock.calls.length - 1][1] as unknown as () => boolean;

    // 벽지 서브픽커에서 백 → 소비(true)하고 전체 패널로 복귀.
    await fireEvent.press(getByLabelText('벽 꾸미기'));
    let handled = false;
    await act(async () => {
      handled = lastHandler()();
    });
    expect(handled).toBe(true);
    expect(getByLabelText('가구 탭')).toBeTruthy();

    // 기본(all) + 변경 없음 → false (셸의 기본 뒤로가기로 폴스루).
    await act(async () => {
      handled = lastHandler()();
    });
    expect(handled).toBe(false);

    // 아이템 추가(dirty) 후 백 → 나가기 확인 모달을 띄우고 소비.
    await fireEvent.press(getByLabelText('소품 탭')); // 장식류는 소품 탭 (#488)
    await fireEvent.press(getByLabelText('초록 식물'));
    await act(async () => {
      handled = lastHandler()();
    });
    expect(handled).toBe(true);
    expect(getByText('변경사항을 저장할까요?')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('RoomDecorScreen — 구매', () => {
  it('buys a not-yet-owned item with dia after confirming', async () => {
    const onBuy = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} ownedIds={['bed']} diaBalance={9999} onBuy={onBuy} />,
    );

    await fireEvent.press(getByLabelText('소품 탭'));
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

    await fireEvent.press(getByLabelText('소품 탭'));
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

    await fireEvent.press(getByLabelText('소품 탭'));
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

    await fireEvent.press(getByLabelText('소품 탭')); // 장식류는 소품 탭 (#488)
    await fireEvent.press(getByLabelText('초록 식물'));
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
    const { getByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout onBack={onBack} onApply={onApply} />,
    );

    await fireEvent.press(getByLabelText('소품 탭')); // 장식류는 소품 탭 (#488)
    await fireEvent.press(getByLabelText('초록 식물'));
    await fireEvent.press(getByLabelText('뒤로가기'));
    await fireEvent.press(getByLabelText('저장하지 않고 나가기'));

    expect(onApply).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('stays on the screen via 계속 꾸미기', async () => {
    const onBack = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout onBack={onBack} />,
    );

    await fireEvent.press(getByLabelText('소품 탭')); // 장식류는 소품 탭 (#488)
    await fireEvent.press(getByLabelText('초록 식물'));
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

    expect(queryByLabelText('오른쪽 회전')).toBeNull();
    await tapItem('plant');
    expect(getByTestId('selection-ring-plant')).toBeTruthy();
    expect(getByLabelText('왼쪽 회전')).toBeTruthy();
    expect(getByLabelText('오른쪽 회전')).toBeTruthy();
    expect(getByLabelText('좌우 반전')).toBeTruthy();
    expect(getByLabelText('맨 앞으로')).toBeTruthy();
    expect(getByLabelText('맨 뒤로')).toBeTruthy();
    expect(getByLabelText('빼기')).toBeTruthy();

    await fireEvent.press(getByLabelText('선택 해제'));
    expect(queryByTestId('selection-ring-plant')).toBeNull();
    expect(queryByLabelText('오른쪽 회전')).toBeNull();
  });

  it('좌·우 회전은 15° 스텝(음수는 360으로 래핑); 좌우 반전 토글', async () => {
    const onApply = jest.fn();
    const { getByTestId, getByText, getByLabelText } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />,
    );
    await layoutCanvas(getByTestId);
    await tapItem('plant');

    await fireEvent.press(getByLabelText('오른쪽 회전'));
    await fireEvent.press(getByLabelText('오른쪽 회전'));
    await fireEvent.press(getByLabelText('왼쪽 회전'));
    await fireEvent.press(getByLabelText('좌우 반전'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(lastApply(onApply)[0]).toEqual(
      expect.objectContaining({ furnitureId: 'plant', rotationDeg: 15, flipped: true }),
    );

    // 0°에서 왼쪽으로 더 돌리면 345°로 래핑; 반전 재탭은 원상복구.
    await fireEvent.press(getByLabelText('왼쪽 회전'));
    await fireEvent.press(getByLabelText('왼쪽 회전'));
    await fireEvent.press(getByLabelText('좌우 반전'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
    expect(lastApply(onApply)[0]).toEqual(
      expect.objectContaining({ rotationDeg: 345, flipped: false }),
    );
  });

  it('맨 앞으로/맨 뒤로 jumps the selected item across the whole stack', async () => {
    const onApply = jest.fn();
    // bed z=1(맨 뒤), plant z=2, rug z=3(맨 앞).
    const { getByTestId, getByText, getByLabelText } = await render(
      <RoomDecorScreen
        initialItems={items(['bed', 'plant', 'rug'])}
        freeLayout
        onApply={onApply}
      />,
    );
    await layoutCanvas(getByTestId);
    await tapItem('bed');

    await fireEvent.press(getByLabelText('맨 앞으로'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    const zOf = (id: string) => lastApply(onApply).find((p) => p.furnitureId === id)?.z ?? 0;
    // 한 번에 전체 스택 위로 — 중간(z 이웃)과의 스왑이 아니다.
    expect(zOf('bed')).toBeGreaterThan(zOf('rug'));
    expect(zOf('rug')).toBeGreaterThan(zOf('plant'));

    await fireEvent.press(getByLabelText('맨 뒤로'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
    expect(zOf('bed')).toBeLessThan(zOf('plant'));
    expect(zOf('plant')).toBeLessThan(zOf('rug'));
  });

  it('빼기 removes the selected item and closes the toolbar', async () => {
    const onApply = jest.fn();
    const { getByTestId, getByText, getByLabelText, queryByLabelText } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />,
    );
    await layoutCanvas(getByTestId);
    await tapItem('plant');

    await fireEvent.press(getByLabelText('빼기'));
    expect(queryByLabelText('오른쪽 회전')).toBeNull();
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
    // scale 2에서 실제 폭이 0.56이 되므로 기존 x=0.20도 최소 중심 0.28로 재클램프된다.
    expect(lastApply(onApply)[0]).toEqual(expect.objectContaining({ scale: 2, x: 0.28 }));

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

  it('drag is clamped to the room bounds — no drag-out removal', async () => {
    const onApply = jest.fn();
    const { getByTestId, getByText } = await render(
      <RoomDecorScreen initialItems={items(['plant'])} freeLayout onApply={onApply} />,
    );
    await layoutCanvas(getByTestId);

    // 캔버스 폭(320px)만큼 오른쪽으로 끌어도 UI 스레드 클램프에 걸려
    // scale 1 기준 중심 0.86에서 멈춘다 — 가구는 빠지지 않는다.
    await act(() =>
      fireGestureHandler(getByGestureTestId('item-pan-plant'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.ACTIVE, translationX: 400, translationY: 0 },
        { state: State.END, translationX: 400, translationY: 0 },
      ]),
    );
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(lastApply(onApply)[0]).toEqual(
      expect.objectContaining({ furnitureId: 'plant', x: 0.86 }),
    );
  });

  it('scaled furniture drag clamp uses its rendered width', async () => {
    const onApply = jest.fn();
    const scaled = items(['plant']).map((item) => ({ ...item, scale: 2 }));
    const { getByTestId, getByText } = await render(
      <RoomDecorScreen initialItems={scaled} freeLayout onApply={onApply} />,
    );
    await layoutCanvas(getByTestId);

    await act(() =>
      fireGestureHandler(getByGestureTestId('item-pan-plant'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.ACTIVE, translationX: 400, translationY: 0 },
        { state: State.END, translationX: 400, translationY: 0 },
      ]),
    );
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    // 0.28 기본 폭 × scale 2 = 0.56, 반경 0.28을 제외한 오른쪽 경계.
    expect(lastApply(onApply)[0]).toEqual(
      expect.objectContaining({ furnitureId: 'plant', x: 0.72 }),
    );
  });
});

describe('RoomDecorScreen — 전체보기 탭', () => {
  it('splits the full catalog into tabs: 가구 default, 소품·벽지 on switch (#488)', async () => {
    const onApply = jest.fn();
    const { getByText, getByLabelText, queryByText, queryByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} freeLayout onApply={onApply} />,
    );

    // 기본 탭은 가구 — 소품(장식류)·벽지는 아직 안 보인다. (이름 텍스트는
    // 표시하지 않으므로 접근성 라벨로 확인, #487)
    expect(getByLabelText('포근한 침대')).toBeTruthy();
    expect(queryByLabelText('초록 식물')).toBeNull();
    expect(queryByText('발자국 패턴')).toBeNull();

    // 소품 탭: 장식·러그류만.
    await fireEvent.press(getByLabelText('소품 탭'));
    expect(getByLabelText('초록 식물')).toBeTruthy();
    expect(queryByLabelText('포근한 침대')).toBeNull();

    await fireEvent.press(getByLabelText('벽지 탭'));
    expect(queryByLabelText('초록 식물')).toBeNull();
    await fireEvent.press(getByLabelText('발자국 패턴'));
    await fireEvent.press(getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith([], 'paw', null, null));
  });

  it('shows 바닥/배경 tabs only when the catalogue has them', async () => {
    const floors: Wallpaper[] = [
      { id: 'f1', name: '원목 바닥재', price: 100, assetKey: 'items/a/floor.png', color: '#EEE' },
    ];

    const bare = await render(<RoomDecorScreen initialItems={[]} />);
    expect(bare.queryByLabelText('바닥 탭')).toBeNull();
    expect(bare.queryByLabelText('배경 탭')).toBeNull();

    const withFloors = await render(<RoomDecorScreen initialItems={[]} floors={floors} />);
    await fireEvent.press(withFloors.getByLabelText('바닥 탭'));
    expect(withFloors.getByLabelText('원목 바닥재')).toBeTruthy();
  });
});

describe('RoomDecorScreen — 보유중 필터', () => {
  it('hides the shop side of the picker with the 보유중 toggle', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <RoomDecorScreen initialItems={[]} ownedIds={['bed']} diaBalance={9999} />,
    );

    // 가구 탭: 보유한 침대 + (미보유) 상점 측이 함께 보인다.
    expect(getByLabelText('포근한 침대')).toBeTruthy();
    // 소품 탭으로 — 미보유 plant는 구매 타일로 보인다.
    await fireEvent.press(getByLabelText('소품 탭'));
    expect(getByLabelText('초록 식물 구매')).toBeTruthy();

    await fireEvent.press(getByLabelText('보유중만 보기'));
    expect(queryByLabelText('초록 식물')).toBeNull();

    // Toggling back restores the shop side.
    await fireEvent.press(getByLabelText('보유중만 보기'));
    expect(queryByLabelText('초록 식물 구매')).toBeTruthy();
  });
});
