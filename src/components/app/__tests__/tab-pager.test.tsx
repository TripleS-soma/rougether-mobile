import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import {
  PAGE_FLING_VELOCITY,
  PAGE_SNAP_RATIO,
  settleTarget,
  TabPager,
} from '@/components/app/tab-pager';

const WIDTH = 360;

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
