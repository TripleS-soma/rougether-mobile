import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import type { AppFrame } from '@/hooks/use-app-frame';

// 웹 데스크톱 2단 (#1230 후속) — 프레임 판정만 바꿔 가며 배치를 본다.
const PHONE: AppFrame = { width: 390, height: 844, scale: 2, fontScale: 1, framed: false, split: false }; // prettier-ignore
const SPLIT: AppFrame = { width: 1200, height: 900, scale: 2, fontScale: 1, framed: true, split: true }; // prettier-ignore

let mockFrame: AppFrame = PHONE;
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => mockFrame,
}));

// 드래그 오버레이는 캔버스 onLayout으로 크기를 알아야 렌더된다 — 본 테스트와 같은 320×384px.
const layoutCanvas = (getByTestId: (id: string) => unknown) =>
  fireEvent(getByTestId('decor-canvas') as never, 'layout', {
    nativeEvent: { layout: { width: 320, height: 384 } },
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

afterEach(() => {
  mockFrame = PHONE;
});

describe('RoomDecorScreen 2단 레이아웃', () => {
  it('폰·좁은 창은 한 스크롤 — 2단 래퍼 없음', async () => {
    const ui = await render(<RoomDecorScreen />);
    expect(ui.queryByTestId('decor-split')).toBeNull();
    expect(ui.getByTestId('decor-canvas')).toBeTruthy();
    expect(ui.getByText('적용하기')).toBeTruthy();
  });

  it('2단이면 왼쪽 캔버스와 오른쪽 카탈로그가 함께 그려지고 적용하기는 블록 폭에 맞춘다', async () => {
    mockFrame = SPLIT;
    const ui = await render(<RoomDecorScreen />);
    expect(ui.getByTestId('decor-split')).toBeTruthy();
    expect(ui.getByTestId('decor-canvas')).toBeTruthy();
    expect(ui.getByText('가구')).toBeTruthy();
    expect(ui.getByLabelText('적용하기')).toBeTruthy();
  });
});

/**
 * 2단 분기의 **동작**. 위 두 테스트는 존재만 보고, 본 테스트(room-decor-screen.test.tsx)는
 * useAppFrame을 목하지 않아 전부 1단 분기를 지나간다. 두 분기가 캔버스·카탈로그 JSX를
 * 따로 들고 있던 동안에는 한쪽만 고쳐도 아무 테스트도 울지 않았다(리팩토링 장부 2라운드
 * 1번). 1단에서 검증하던 핵심 흐름을 2단에서 같은 기대값으로 돌린다.
 */
describe('RoomDecorScreen 2단 레이아웃 — 동작', () => {
  beforeEach(() => {
    mockFrame = SPLIT;
  });

  it('소품 탭에서 가구를 놓고 적용하면 방 가운데에 저장된다', async () => {
    const onApply = jest.fn();
    const ui = await render(<RoomDecorScreen initialItems={[]} onApply={onApply} />);
    expect(ui.getByTestId('decor-split')).toBeTruthy();

    await fireEvent.press(ui.getByLabelText('소품 탭'));
    await fireEvent.press(ui.getByLabelText('초록 식물'));
    await fireEvent.press(ui.getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(onApply.mock.calls[0][0]).toEqual([
      expect.objectContaining({ furnitureId: 'plant', x: 0.5, y: 0.55, z: 1 }),
    ]);
  });

  it('왼쪽 캔버스의 벽을 탭하면 오른쪽 카탈로그가 벽지 픽커가 되고 고른 벽지가 저장된다', async () => {
    const onApply = jest.fn();
    const ui = await render(<RoomDecorScreen initialItems={[]} onApply={onApply} />);

    await fireEvent.press(ui.getByLabelText('벽 꾸미기'));
    await fireEvent.press(ui.getByLabelText('발자국 패턴'));
    await fireEvent.press(ui.getByText('적용하기'));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith([], 'paw', null, null));
  });

  it('프리뷰 가구를 선택하면 툴바가 뜨고, 다시 탭하면 구매 확인이 열린다', async () => {
    const onBuy = jest.fn(async () => true);
    const ui = await render(
      <RoomDecorScreen initialItems={[]} ownedIds={['bed']} diamondBalance={9999} onBuy={onBuy} />,
    );

    await fireEvent.press(ui.getByLabelText('소품 탭'));
    await fireEvent.press(ui.getByLabelText('초록 식물 미리 배치'));
    await layoutCanvas(ui.getByTestId);

    await tapItem('plant'); // 첫 탭 = 선택
    expect(ui.getByTestId('selection-ring-plant')).toBeTruthy();
    expect(ui.getByTestId('selection-toolbar')).toBeTruthy();

    await tapItem('plant'); // 선택 상태에서 한 번 더 = 구매 확인
    expect(ui.getByText(/초록 식물.*구매해요/)).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('구매 확인'));
    expect(onBuy).toHaveBeenCalledWith('plant');
  });

  it('선택 툴바의 빼기가 캔버스에서 가구를 뺀다', async () => {
    const ui = await render(
      <RoomDecorScreen initialItems={[]} ownedIds={['bed']} diamondBalance={9999} />,
    );
    await fireEvent.press(ui.getByLabelText('소품 탭'));
    await fireEvent.press(ui.getByLabelText('초록 식물 미리 배치'));
    await layoutCanvas(ui.getByTestId);
    await tapItem('plant');

    await fireEvent.press(ui.getByLabelText('빼기'));
    expect(ui.queryByLabelText('초록 식물 프리뷰 옮기기')).toBeNull();
    expect(ui.queryByTestId('selection-toolbar')).toBeNull();
  });

  it('카탈로그를 불러오는 중이면 캔버스 옆 칸에 로딩 표시를 그린다', async () => {
    const ui = await render(<RoomDecorScreen loading />);
    expect(ui.getByTestId('decor-canvas')).toBeTruthy();
    expect(ui.getByText('카탈로그 불러오는 중...')).toBeTruthy();
  });

  it('카탈로그를 못 불러오면 캔버스 옆 칸에 재시도를 그린다', async () => {
    const ui = await render(<RoomDecorScreen loadError onRetry={jest.fn()} />);
    expect(ui.getByTestId('decor-canvas')).toBeTruthy();
    expect(ui.getByText('카탈로그를 불러오지 못했어요.')).toBeTruthy();
  });
});
