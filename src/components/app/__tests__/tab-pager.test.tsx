import { act, fireEvent, render } from '@testing-library/react-native';
import { DeviceEventEmitter, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import * as Reanimated from 'react-native-reanimated';

import {
  PAGE_FLING_VELOCITY,
  PAGE_SNAP_RATIO,
  settleTarget,
  TabPager,
} from '@/components/app/tab-pager';

const WIDTH = 360;

afterEach(() => jest.restoreAllMocks());

function Harness({ index, onIndexChange }: { index: number; onIndexChange: (i: number) => void }) {
  return (
    <TabPager index={index} onIndexChange={onIndexChange}>
      <Text>나의 방 페이지</Text>
      <Text>집 페이지</Text>
      <Text>설정 페이지</Text>
    </TabPager>
  );
}

async function renderPager(index = 0, onIndexChange: (i: number) => void = () => {}) {
  const utils = await render(<Harness index={index} onIndexChange={onIndexChange} />);
  await act(async () => {
    fireEvent(utils.getByTestId('tab-pager'), 'layout', {
      nativeEvent: { layout: { width: WIDTH, height: 640 } },
    });
  });
  return utils;
}

const fling = (translationX: number, velocityX = 0) =>
  act(async () =>
    fireGestureHandler(getByGestureTestId('tab-pager-pan'), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END, translationX, translationY: 0, velocityX },
    ]),
  );

describe('TabPager (#563)', () => {
  it.each([
    { index: 0, dx: -240, state: State.CANCELLED },
    { index: 1, dx: -240, state: State.CANCELLED },
    { index: 2, dx: 240, state: State.CANCELLED },
    { index: 1, dx: 240, state: State.FAILED },
  ])(
    'restores page $index without navigating when an active swipe ends in $state',
    async ({ index, dx, state }) => {
      const onIndexChange = jest.fn();
      const timing = jest.spyOn(Reanimated, 'withTiming');
      await renderPager(index, onIndexChange);
      await act(async () => {
        fireGestureHandler(getByGestureTestId('tab-pager-pan'), [
          { state: State.BEGAN },
          { state: State.ACTIVE, translationX: 0 },
          { state: State.ACTIVE, translationX: dx },
          { state, translationX: dx, velocityX: Math.sign(dx) * 1000 },
        ]);
      });
      expect(onIndexChange).not.toHaveBeenCalled();
      expect(timing.mock.calls.at(-1)?.[0]).toBe(-index * WIDTH);
      // A new successful swipe still works after the interrupted one.
      await fling(dx);
      expect(onIndexChange.mock.calls).toEqual([[index + (dx < 0 ? 1 : -1)]]);
    },
  );

  it('keeps neighboring pages visible until the cancelled swipe finishes returning', async () => {
    let finish: ((finished?: boolean) => void) | undefined;
    jest.spyOn(Reanimated, 'withTiming').mockImplementation((target, _config, callback) => {
      finish = callback;
      return target;
    });
    const onIndexChange = jest.fn();
    const ui = await renderPager(1, onIndexChange);
    await act(async () => {
      fireGestureHandler(getByGestureTestId('tab-pager-pan'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.ACTIVE, translationX: -200 },
        { state: State.CANCELLED, translationX: -200 },
      ]);
    });
    await ui.rerender(<Harness index={1} onIndexChange={onIndexChange} />);
    expect(ui.getByText('나의 방 페이지')).toBeTruthy();
    expect(ui.getByText('설정 페이지')).toBeTruthy();
    expect(finish).toBeDefined();
    await act(async () => finish?.(true));
    await ui.rerender(<Harness index={1} onIndexChange={onIndexChange} />);
    expect(ui.getByText('집 페이지')).toBeTruthy();
    expect(ui.queryByText('나의 방 페이지')).toBeNull();
    expect(ui.queryByText('설정 페이지')).toBeNull();
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('does not interrupt an external tab transition when a touch fails before activation', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming').mockImplementation((target) => target);
    const onIndexChange = jest.fn();
    const ui = await renderPager(0, onIndexChange);
    await ui.rerender(<Harness index={1} onIndexChange={onIndexChange} />);
    const { handlerTag } = getByGestureTestId('tab-pager-pan');
    // fireGestureHandler inserts ACTIVE automatically, so emit the actual
    // BEGAN -> FAILED sequence for a tap/vertical scroll/locked touch.
    await act(async () => {
      DeviceEventEmitter.emit('onGestureHandlerStateChange', {
        handlerTag,
        state: State.BEGAN,
        oldState: State.UNDETERMINED,
      });
      DeviceEventEmitter.emit('onGestureHandlerStateChange', {
        handlerTag,
        state: State.FAILED,
        oldState: State.BEGAN,
      });
    });
    await ui.rerender(<Harness index={1} onIndexChange={onIndexChange} />);
    expect(ui.getByText('나의 방 페이지')).toBeTruthy();
    expect(ui.getByText('설정 페이지')).toBeTruthy();
    expect(timing).toHaveBeenCalledTimes(1);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('활성 페이지만 보이고 비활성 이웃은 그리지 않는다', async () => {
    const { getByText, queryByText } = await renderPager(0);
    expect(getByText('나의 방 페이지')).toBeTruthy();
    expect(queryByText('집 페이지')).toBeNull();
    expect(queryByText('설정 페이지')).toBeNull();
  });

  it('폭의 스냅 비율을 넘긴 좌플링이 다음 페이지로 넘긴다', async () => {
    const onIndexChange = jest.fn();
    await renderPager(0, onIndexChange);
    await fling(-(WIDTH * PAGE_SNAP_RATIO + 10));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('짧게 끌어도 플링 속도를 넘기면 넘어간다', async () => {
    const onIndexChange = jest.fn();
    await renderPager(1, onIndexChange);
    await fling(-40, -(PAGE_FLING_VELOCITY + 100));
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it('임계 미달 릴리즈는 페이지를 바꾸지 않는다', async () => {
    const onIndexChange = jest.fn();
    await renderPager(1, onIndexChange);
    await fling(-40);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('첫 페이지에서 우플링은 클램프된다', async () => {
    const onIndexChange = jest.fn();
    await renderPager(0, onIndexChange);
    await fling(WIDTH);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('외부 인덱스 변경(탭 버튼)을 따라간다', async () => {
    const onIndexChange = jest.fn();
    const utils = await renderPager(0, onIndexChange);
    await act(async () => {
      utils.rerender(<Harness index={2} onIndexChange={onIndexChange} />);
    });
    // 정착 애니메이션이 돌아도 콜백은 다시 부르지 않는다 — 외부가 진실.
    expect(onIndexChange).not.toHaveBeenCalled();
  });
});

describe('settleTarget', () => {
  const W = 360;
  it('이동 임계·속도 임계·클램프를 판정한다', () => {
    expect(settleTarget(0, -W * 0.4, 0, W, 3)).toBe(1);
    expect(settleTarget(1, W * 0.4, 0, W, 3)).toBe(0);
    expect(settleTarget(0, -10, -PAGE_FLING_VELOCITY, W, 3)).toBe(1);
    expect(settleTarget(0, -10, 0, W, 3)).toBe(0); // 임계 미달
    expect(settleTarget(2, -W, 0, W, 3)).toBe(2); // 마지막 페이지 클램프
    expect(settleTarget(0, W, 0, W, 3)).toBe(0); // 첫 페이지 클램프
  });
});
