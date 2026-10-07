import { act, render } from '@testing-library/react-native';
import { View } from 'react-native';
import { GestureDetector, State } from 'react-native-gesture-handler';
import { fireGestureHandler } from 'react-native-gesture-handler/jest-utils';

import { useSeatDrag } from '@/components/screens/house/use-seat-drag';

// 좌석 드래그 앤 드롭 (#278·#776) — 놓은 자리의 좌석과 맞바꾼다. 집 화면 분리(장부 15번) 전엔
// 드롭 교환을 보는 테스트가 없었다(롱프레스 잠금만 봤다).
const rect = (y: number) =>
  ({
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
      cb(0, y, 100, 100),
  }) as unknown as View;

type Drag = ReturnType<typeof useSeatDrag>;

/** 제스처는 GestureDetector에 붙어야 jest-utils가 핸들러를 찾는다 — 화면처럼 격자 하나에 붙인다. */
function Harness({
  swapSeats,
  out,
}: {
  swapSeats: (from: number, to: number) => void;
  out: { current?: Drag };
}) {
  const drag = useSeatDrag({ swapSeats });
  out.current = drag;
  return (
    <GestureDetector gesture={drag.frameDragGesture}>
      <View />
    </GestureDetector>
  );
}

async function setup() {
  const swapSeats = jest.fn();
  const out: { current?: Drag } = {};
  await render(<Harness swapSeats={swapSeats} out={out} />);
  // 좌석 0은 y 0~100, 좌석 1은 y 200~300.
  out.current!.tileRefs.current.set(0, rect(0));
  out.current!.tileRefs.current.set(1, rect(200));
  return { swapSeats, result: out as { current: Drag } };
}

describe('useSeatDrag', () => {
  it('좌석 0을 들어 좌석 1 위에 놓으면 둘을 맞바꾼다', async () => {
    const { result, swapSeats } = await setup();
    await act(async () => result.current.startDrag(0));
    expect(result.current.dragSeat).toBe(0);
    await act(async () =>
      fireGestureHandler(result.current.frameDragGesture, [
        { state: State.BEGAN },
        { state: State.ACTIVE, translationY: 120 },
        { state: State.END, absoluteX: 50, absoluteY: 250 },
      ]),
    );
    expect(swapSeats).toHaveBeenCalledWith(0, 1);
    expect(result.current.dragSeat).toBeNull();
  });

  it('제자리나 빈 곳에 놓으면 바꾸지 않고 내려놓는다', async () => {
    const { result, swapSeats } = await setup();
    await act(async () => result.current.startDrag(0));
    await act(async () =>
      fireGestureHandler(result.current.frameDragGesture, [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END, absoluteX: 50, absoluteY: 150 },
      ]),
    );
    expect(swapSeats).not.toHaveBeenCalled();
    expect(result.current.dragSeat).toBeNull();
  });
});
