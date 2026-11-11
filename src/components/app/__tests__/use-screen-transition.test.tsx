import { act, render, renderHook } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Animated, Text, View } from 'react-native';

import { livesInPager, type Screen } from '@/components/app/navigation';
import {
  isBackTransition,
  usePagerTab,
  useScreenTransition,
} from '@/components/app/use-screen-transition';

const tabsMounts = jest.fn();
const tabsUnmounts = jest.fn();

/** 탭 페이저 흉내 — 마운트/언마운트 횟수를 센다. */
function Tabs({ screen }: { screen: Screen }) {
  useEffect(() => {
    tabsMounts();
    return () => tabsUnmounts();
  }, []);
  return <Text>{`tabs:${screen}`}</Text>;
}

/** 셸 흉내 — 탭 층에는 페이저를, 서브 층에는 화면 이름을 그리고 층을 그대로 펼친다. */
function Harness({ screen }: { screen: Screen }) {
  const layers = useScreenTransition({
    screen,
    addReturnScreen: 'routineManage',
    tabsNode: <Tabs screen={screen} />,
    node: livesInPager(screen) ? null : <Text>{`screen:${screen}`}</Text>,
  });
  return (
    <View>
      {layers.map((l) => (
        <Animated.View
          key={l.key}
          testID={`layer-${l.key}`}
          pointerEvents={l.pointerEvents}
          accessibilityElementsHidden={l.hidden}
          importantForAccessibility={l.hidden ? 'no-hide-descendants' : 'auto'}>
          {l.node}
        </Animated.View>
      ))}
    </View>
  );
}

const hidden = { includeHiddenElements: true };

// 층 슬라이드 (#1094) — 탭 화면은 상주 층에 살고, 서브화면은 a/b 층을 번갈아 쓴다. 전환 중에는
// 떠나는 서브화면이 스테일 노드로 함께 살고, 끝나면 비워진다.
describe('useScreenTransition', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    tabsMounts.mockClear();
    tabsUnmounts.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('진입: 서브화면은 서브 층에 서고, 탭 층은 밀려난 뒤 숨는다', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    expect(ui.getByTestId('layer-tabs')).toHaveTextContent('tabs:myRoom');
    expect(ui.getByTestId('layer-tabs').props.pointerEvents).toBe('auto');
    expect(ui.getByTestId('layer-a', hidden)).toBeEmptyElement();
    expect(ui.getByTestId('layer-b', hidden)).toBeEmptyElement();
    // 빈 서브 층이 화면을 덮고 있어도 탭 층으로 가는 터치를 가로채지 않는다.
    expect(ui.getByTestId('layer-a', hidden).props.pointerEvents).toBe('none');

    await ui.rerender(<Harness screen="settings" />);
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:settings');
    expect(ui.getByTestId('layer-a').props.pointerEvents).toBe('auto');
    // 떠나는 탭 층은 슬라이드 동안 보이되 터치는 막힌다.
    expect(ui.getByTestId('layer-tabs').props.pointerEvents).toBe('none');
    expect(ui.getByTestId('layer-tabs').props.accessibilityElementsHidden).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    // 슬라이드가 끝나면 숨는다 — 스크린 리더·테스트 쿼리에 잡히지 않는다.
    expect(ui.queryByTestId('layer-tabs')).toBeNull();
    expect(ui.getByTestId('layer-tabs', hidden).props.accessibilityElementsHidden).toBe(true);
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:settings');
  });

  // 2026-11-11 제보(갤럭시 S25 울트라): 서브화면에 들어갈 때마다 페이저(다섯 탭)가 통째로
  // 언마운트됐다가 돌아올 때 다시 마운트돼, 복귀 슬라이드가 약 240ms 멈췄다.
  it('서브화면을 오가도 탭 페이저는 한 번만 마운트된다', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    for (const screen of ['settings', 'theme', 'settings', 'myPage', 'gacha', 'myRoom'] as const) {
      await ui.rerender(<Harness screen={screen} />);
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
    }
    expect(tabsMounts).toHaveBeenCalledTimes(1);
    expect(tabsUnmounts).not.toHaveBeenCalled();
    expect(ui.getByTestId('layer-tabs')).toHaveTextContent('tabs:myRoom');
    expect(ui.getByTestId('layer-tabs').props.pointerEvents).toBe('auto');
  });

  it('복귀: 탭 층은 숨김이 풀려 돌아오고, 떠나는 서브화면은 300ms 동안 남았다가 비워진다', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    await ui.rerender(<Harness screen="settings" />);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await ui.rerender(<Harness screen="myPage" />);
    // 탭 층은 스테일 노드가 아니라 최신 화면을 그린다.
    expect(ui.getByTestId('layer-tabs')).toHaveTextContent('tabs:myPage');
    expect(ui.getByTestId('layer-tabs').props.pointerEvents).toBe('auto');
    // 떠나는 서브화면은 스테일 노드 그대로, 터치는 막힌다.
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:settings');
    expect(ui.getByTestId('layer-a').props.pointerEvents).toBe('none');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(ui.getByTestId('layer-a')).toBeEmptyElement();
  });

  it('같은 화면의 리렌더는 층을 옮기지 않는다 (리마운트 금지)', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    await ui.rerender(<Harness screen="settings" />);
    await ui.rerender(<Harness screen="settings" />);
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:settings');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await ui.rerender(<Harness screen="settings" />);
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:settings');
    expect(ui.getByTestId('layer-b')).toBeEmptyElement();
  });

  it('탭 간 전환은 층을 바꾸지 않는다 — 페이저 몫', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    await ui.rerender(<Harness screen="house" />);
    expect(ui.getByTestId('layer-tabs')).toHaveTextContent('tabs:house');
    expect(ui.getByTestId('layer-tabs').props.pointerEvents).toBe('auto');
    expect(ui.getByTestId('layer-a', hidden)).toBeEmptyElement();
    expect(ui.getByTestId('layer-b', hidden)).toBeEmptyElement();
  });

  it('서브화면 사이의 전환은 두 서브 층이 번갈아 맡는다', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    await ui.rerender(<Harness screen="settings" />);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await ui.rerender(<Harness screen="theme" />);
    expect(ui.getByTestId('layer-b')).toHaveTextContent('screen:theme');
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:settings');
    expect(ui.getByTestId('layer-a').props.pointerEvents).toBe('none');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(ui.getByTestId('layer-a')).toBeEmptyElement();
    // 탭 층은 내내 숨은 채 마운트돼 있다.
    expect(ui.getByTestId('layer-tabs', hidden).props.accessibilityElementsHidden).toBe(true);
  });

  it('전환 중 또 바뀌면 최신 전환이 이어받는다', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    await ui.rerender(<Harness screen="settings" />);
    await ui.rerender(<Harness screen="theme" />);
    // settings(층 a)가 떠나고 theme이 층 b로.
    expect(ui.getByTestId('layer-b')).toHaveTextContent('screen:theme');
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:settings');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(ui.getByTestId('layer-a')).toBeEmptyElement();
  });

  it('달력 탭 ↔ 주간 보기는 층을 바꾸지 않는다 — 화면이 스스로 접힘을 연출 (#1327)', async () => {
    const ui = await render(<Harness screen="calendar" />);
    await ui.rerender(<Harness screen="calendarWeek" />);
    expect(ui.getByTestId('layer-tabs')).toHaveTextContent('tabs:calendarWeek');
    expect(ui.getByTestId('layer-a', hidden)).toBeEmptyElement();
    await ui.rerender(<Harness screen="calendar" />);
    expect(ui.getByTestId('layer-tabs')).toHaveTextContent('tabs:calendar');
    expect(ui.getByTestId('layer-a', hidden)).toBeEmptyElement();
    // 주간 보기에서 연 서브화면은 종전대로 슬라이드.
    await ui.rerender(<Harness screen="calendarWeek" />);
    await ui.rerender(<Harness screen="addRoutine" />);
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:addRoutine');
    expect(ui.getByTestId('layer-tabs').props.pointerEvents).toBe('none');
    expect(tabsMounts).toHaveBeenCalledTimes(1);
  });

  it('서브화면에서 시작하면 탭 페이저는 처음 탭 화면이 뜰 때 마운트한다', async () => {
    const ui = await render(<Harness screen="houseSearch" />);
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:houseSearch');
    expect(tabsMounts).not.toHaveBeenCalled();
    await ui.rerender(<Harness screen="house" />);
    expect(tabsMounts).toHaveBeenCalledTimes(1);
    expect(ui.getByTestId('layer-tabs')).toHaveTextContent('tabs:house');
  });

  it('isBackTransition — 백맵·연 곳 복귀·서브→탭', () => {
    expect(isBackTransition('theme', 'settings', 'routineManage')).toBe(true);
    expect(isBackTransition('addRoutine', 'routineManage', 'routineManage')).toBe(true);
    expect(isBackTransition('settings', 'myPage', 'routineManage')).toBe(true);
    expect(isBackTransition('settings', 'theme', 'routineManage')).toBe(false);
  });
});

describe('usePagerTab', () => {
  it('서브화면에 있는 동안 마지막 탭을 그대로 든다', async () => {
    const { result, rerender } = await renderHook((screen: Screen) => usePagerTab(screen), {
      initialProps: 'house' as Screen,
    });
    expect(result.current).toBe('house');
    await rerender('houseSearch');
    expect(result.current).toBe('house');
    await rerender('calendarWeek');
    expect(result.current).toBe('calendar');
    await rerender('addRoutine');
    expect(result.current).toBe('calendar');
    await rerender('myPage');
    expect(result.current).toBe('myPage');
  });
});
