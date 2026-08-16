import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { HouseOrderDots, movedTo } from '@/components/room/house-order-dots';

const HOUSES = [
  { houseId: 1, name: 'TripleS' },
  { houseId: 2, name: '우리집' },
  { houseId: 3, name: '스터디방' },
];

/** 꾹 누른 뒤 dx만큼 끌고 놓는다 — activateAfterLongPress는 jest-utils가 건너뛴다. */
const drag = (dx: number) =>
  act(async () =>
    fireGestureHandler(getByGestureTestId('house-order-drag'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationX: 0 },
      { state: State.ACTIVE, translationX: dx },
      { state: State.END, translationX: dx },
    ]),
  );

describe('movedTo', () => {
  it('원소를 목표 위치로 옮긴다', () => {
    expect(movedTo(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(movedTo(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('제자리·범위 밖은 원본을 그대로 돌려준다', () => {
    const list = ['a', 'b', 'c'];
    expect(movedTo(list, 1, 1)).toBe(list);
    expect(movedTo(list, 5, 0)).toBe(list);
  });
});

describe('HouseOrderDots (#820)', () => {
  it('꾹 눌러 끌면 새 순서를 houseId 배열로 전량 넘긴다', async () => {
    const onReorder = jest.fn();
    await render(<HouseOrderDots houses={HOUSES} index={0} onReorder={onReorder} />);

    // 첫 집을 한 칸(=CHIP_W 96) 오른쪽으로.
    await drag(96);

    expect(onReorder).toHaveBeenCalledWith([2, 1, 3]);
  });

  it('제자리에 놓으면 저장하지 않는다', async () => {
    const onReorder = jest.fn();
    await render(<HouseOrderDots houses={HOUSES} index={0} onReorder={onReorder} />);

    // 한 칸 임계(96)에 못 미치는 이동은 같은 자리로 반올림된다.
    await drag(20);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('끝을 넘겨 끌어도 목록 밖으로 나가지 않는다', async () => {
    const onReorder = jest.fn();
    await render(<HouseOrderDots houses={HOUSES} index={0} onReorder={onReorder} />);

    await drag(96 * 10);

    expect(onReorder).toHaveBeenCalledWith([2, 3, 1]);
  });

  it('집이 하나뿐이면 정렬 제스처를 붙이지 않는다', async () => {
    await render(
      <HouseOrderDots houses={[HOUSES[0]]} index={0} onReorder={jest.fn()} />, //
    );
    expect(() => getByGestureTestId('house-order-drag')).toThrow();
  });

  it('onReorder가 없으면 정렬 제스처를 붙이지 않는다 — 읽기 전용 인디케이터', async () => {
    await render(<HouseOrderDots houses={HOUSES} index={0} />);
    expect(() => getByGestureTestId('house-order-drag')).toThrow();
  });

  /**
   * 승인 대기 잠금 카드(#648)는 내 집이 아니다 — 도트에는 세지만 순서
   * 대상에서는 빠지고 항상 끝에 남는다.
   */
  it('대기 페이지에서 시작해도 내 집만 재정렬한다', async () => {
    const onReorder = jest.fn();
    await render(
      <HouseOrderDots houses={HOUSES} pendingCount={1} index={3} onReorder={onReorder} />,
    );

    // index 3 = 대기 페이지. 마지막 집(index 2)으로 클램프된 뒤 한 칸 앞으로.
    await drag(-96);

    expect(onReorder).toHaveBeenCalledWith([1, 3, 2]);
  });
});
