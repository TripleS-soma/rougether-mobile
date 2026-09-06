import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { TabPager } from '@/components/app/tab-pager';
import { PagerScrollView } from '@/components/ui/pager-scroll-view';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';

afterEach(() => jest.restoreAllMocks());

describe('Pager scroll arbitration (#1150)', () => {
  it.each([true, false])(
    'connects the native scroll to the actual ancestor pager (refresh=%s)',
    async (refresh) => {
      const nativeFactory = jest.spyOn(Gesture, 'Native');
      await render(
        <TabPager index={0} onIndexChange={jest.fn()}>
          <PawRefreshScroll onRefresh={refresh ? jest.fn() : undefined}>
            <Text>집 본문</Text>
          </PawRefreshScroll>
          <Text>다음 페이지</Text>
        </TabPager>,
      );
      const pager = getByGestureTestId('tab-pager-pan');
      // Hooks also allocate an unused Native gesture in the no-refresh path.
      // Assert the mounted handler's serialized dependency, sent to native.
      const mounted = nativeFactory.mock.results
        .map(({ value }) => value)
        .filter((g) => g.handlerTag > 0);
      expect(mounted).toHaveLength(1);
      expect(mounted[0].config.requireToFail).toContain(pager.handlerTag);
      if (refresh) {
        expect(getByGestureTestId('paw-refresh-pan').config.requireToFail).toContain(
          pager.handlerTag,
        );
      }
    },
  );

  it('also connects plain scrolls such as MyPage, and preserves scroll props', async () => {
    const nativeFactory = jest.spyOn(Gesture, 'Native');
    const onScroll = jest.fn();
    const ui = await render(
      <TabPager index={0} onIndexChange={jest.fn()}>
        <PagerScrollView testID="plain-scroll" onScroll={onScroll} contentOffset={{ x: 0, y: 120 }}>
          <Text>마이페이지 본문</Text>
        </PagerScrollView>
        <Text>이웃</Text>
      </TabPager>,
    );
    expect(nativeFactory.mock.results[0].value.config.requireToFail).toContain(
      getByGestureTestId('tab-pager-pan').handlerTag,
    );
    expect(ui.getByTestId('plain-scroll').props.onScroll).toBe(onScroll);
    expect(ui.getByTestId('plain-scroll').props.contentOffset).toEqual({ x: 0, y: 120 });
  });

  it('does not introduce a wait dependency on standalone screens', async () => {
    const nativeFactory = jest.spyOn(Gesture, 'Native');
    await render(
      <PawRefreshScroll onRefresh={jest.fn()}>
        <Text>서브화면</Text>
      </PawRefreshScroll>,
    );
    expect(nativeFactory.mock.results[0].value.config.requireToFail).toEqual([]);
    expect(getByGestureTestId('paw-refresh-pan').config.requireToFail).toEqual([]);
  });
});
