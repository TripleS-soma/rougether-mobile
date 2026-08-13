import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';

/** 맨 위에서 translationY만큼 당겼다 놓는 팬 시퀀스. */
const pullAndRelease = (translationY: number) =>
  fireGestureHandler(getByGestureTestId('paw-refresh-pan'), [
    { state: State.BEGAN },
    // 첫 ACTIVE는 onStart로 소비된다 — 두 번째부터 onUpdate.
    { state: State.ACTIVE, translationY: 0 },
    { state: State.ACTIVE, translationY: 0 },
    { state: State.ACTIVE, translationY },
    { state: State.END, translationY },
  ]);

describe('PawRefreshScroll (#454 — 곰 발바닥 pull-to-refresh)', () => {
  it('renders children and the paw indicator', async () => {
    const { getByText, getByTestId } = await render(
      <PawRefreshScroll onRefresh={jest.fn()}>
        <Text>콘텐츠</Text>
      </PawRefreshScroll>,
    );
    expect(getByText('콘텐츠')).toBeTruthy();
    expect(getByTestId('paw-refresh-paw')).toBeTruthy();
  });

  it('임계(당김 112px = 저항 후 56px)를 넘겨 놓으면 onRefresh가 불린다', async () => {
    const onRefresh = jest.fn(() => Promise.resolve());
    await render(
      <PawRefreshScroll onRefresh={onRefresh}>
        <Text>콘텐츠</Text>
      </PawRefreshScroll>,
    );
    pullAndRelease(140);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('임계 미만의 당김은 새로고침 없이 되돌아간다', async () => {
    const onRefresh = jest.fn(() => Promise.resolve());
    await render(
      <PawRefreshScroll onRefresh={onRefresh}>
        <Text>콘텐츠</Text>
      </PawRefreshScroll>,
    );
    pullAndRelease(80); // 저항 후 40px < 임계 56px
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('리스트 중간(scrollY > 0)에서는 당김이 쌓이지 않는다', async () => {
    const onRefresh = jest.fn(() => Promise.resolve());
    const { getByTestId } = await render(
      <PawRefreshScroll onRefresh={onRefresh} testID="scroll">
        <Text>콘텐츠</Text>
      </PawRefreshScroll>,
    );
    // 스크롤을 내린 상태를 흉내낸다.
    getByTestId('scroll').props.onScroll({ nativeEvent: { contentOffset: { y: 120 } } });
    pullAndRelease(200);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('refreshDisabled 동안은 임계를 넘겨도 무시한다 (자리 드래그 잠금)', async () => {
    const onRefresh = jest.fn(() => Promise.resolve());
    await render(
      <PawRefreshScroll onRefresh={onRefresh} refreshDisabled>
        <Text>콘텐츠</Text>
      </PawRefreshScroll>,
    );
    pullAndRelease(200);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('onRefresh가 없으면 평범한 ScrollView로 동작한다 (당김 헤더 없음)', async () => {
    const { getByText, queryByTestId } = await render(
      <PawRefreshScroll>
        <Text>콘텐츠</Text>
      </PawRefreshScroll>,
    );
    expect(getByText('콘텐츠')).toBeTruthy();
    expect(queryByTestId('paw-refresh-paw')).toBeNull();
  });
});
