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

  /**
   * scrollY 공유값이 실제 오프셋과 어긋나면 당김이 조용히 죽는다 (#898).
   * 낡는 경로가 두 개다 — 둘 다 `onScroll`이 안 오는 구간이라 캐시가 안 맞는다.
   */
  describe('scrollY가 낡는 경우 (#898)', () => {
    it('콘텐츠가 짧아져 맨 위로 클램프되면 당김이 다시 살아난다', async () => {
      // 탭을 바꾸거나 새로고침으로 목록이 짧아지면 RN이 오프셋을 0으로
      // 당기는데 onScroll을 쏘지 않는다. 캐시만 믿으면 "리스트 중간"으로
      // 오판해 당김이 영영 안 먹는다 — 사용자가 한 번 스크롤해야 풀렸다.
      const onRefresh = jest.fn(() => Promise.resolve());
      const { getByTestId } = await render(
        <PawRefreshScroll onRefresh={onRefresh} testID="scroll">
          <Text>콘텐츠</Text>
        </PawRefreshScroll>,
      );
      const scroll = getByTestId('scroll');
      scroll.props.onLayout({ nativeEvent: { layout: { height: 800 } } });
      scroll.props.onContentSizeChange(400, 2000);
      scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 900 } } });
      // 짧은 탭으로 전환 — 콘텐츠가 뷰포트보다 작아져 실제 오프셋은 0이 된다.
      scroll.props.onContentSizeChange(400, 600);

      pullAndRelease(200);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('스크롤 위치를 복원한 직후에는 당김이 먹지 않는다', async () => {
      // useScrollRestore가 넘기는 contentOffset prop은 onScroll을 쏘지 않는다.
      // 캐시가 0으로 시작하면 리스트 중간인데 당김이 먹는 반대 사고가 난다.
      const onRefresh = jest.fn(() => Promise.resolve());
      await render(
        <PawRefreshScroll onRefresh={onRefresh} contentOffset={{ x: 0, y: 300 }}>
          <Text>콘텐츠</Text>
        </PawRefreshScroll>,
      );
      pullAndRelease(200);
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('호출부의 onContentSizeChange를 삼키지 않는다', async () => {
      // useScrollRestore가 이 콜백으로 복원 스크롤을 건다 — 가로채면 복원이 죽는다.
      const onContentSizeChange = jest.fn();
      const { getByTestId } = await render(
        <PawRefreshScroll
          onRefresh={jest.fn()}
          testID="scroll"
          onContentSizeChange={onContentSizeChange}>
          <Text>콘텐츠</Text>
        </PawRefreshScroll>,
      );
      getByTestId('scroll').props.onContentSizeChange(400, 2000);
      expect(onContentSizeChange).toHaveBeenCalledWith(400, 2000);
    });
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
