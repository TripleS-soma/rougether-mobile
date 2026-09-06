import { act, render } from '@testing-library/react-native';
import { Animated, Text, View } from 'react-native';

import type { Screen } from '@/components/app/navigation';
import { isBackTransition, useScreenTransition } from '@/components/app/use-screen-transition';

/** 셸 흉내 — 화면 이름을 노드로 그리고 두 층을 그대로 펼친다. */
function Harness({ screen }: { screen: Screen }) {
  const layers = useScreenTransition({
    screen,
    addReturnScreen: 'routineManage',
    node: <Text>{`screen:${screen}`}</Text>,
  });
  return (
    <View>
      {layers.map((l) => (
        <Animated.View key={l.key} testID={`layer-${l.key}`} pointerEvents={l.pointerEvents}>
          {l.node}
        </Animated.View>
      ))}
    </View>
  );
}

// 두 층 슬라이드 (#1094) — 전환 중에는 떠나는 화면이 스테일 노드로 함께 살고,
// 끝나면 비워진다. 현재 화면은 전환 중에도 같은 층에 머문다.
describe('useScreenTransition', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('진입: 새 화면은 다른 층에, 떠나는 화면은 300ms 동안 남았다가 비워진다', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:myRoom');
    expect(ui.getByTestId('layer-b')).toBeEmptyElement();

    await ui.rerender(<Harness screen="settings" />);
    expect(ui.getByTestId('layer-b')).toHaveTextContent('screen:settings');
    // 떠나는 층은 스테일 노드 그대로, 터치는 막힌다.
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:myRoom');
    expect(ui.getByTestId('layer-a').props.pointerEvents).toBe('none');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(ui.getByTestId('layer-a')).toBeEmptyElement();
    expect(ui.getByTestId('layer-b')).toHaveTextContent('screen:settings');
  });

  it('같은 화면의 리렌더는 층을 옮기지 않는다 (리마운트 금지)', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    await ui.rerender(<Harness screen="settings" />);
    await ui.rerender(<Harness screen="settings" />);
    expect(ui.getByTestId('layer-b')).toHaveTextContent('screen:settings');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await ui.rerender(<Harness screen="settings" />);
    expect(ui.getByTestId('layer-b')).toHaveTextContent('screen:settings');
    expect(ui.getByTestId('layer-a')).toBeEmptyElement();
  });

  it('탭 간 전환은 층을 바꾸지 않는다 — 페이저 몫', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    await ui.rerender(<Harness screen="house" />);
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:house');
    expect(ui.getByTestId('layer-b')).toBeEmptyElement();
  });

  it('전환 중 또 바뀌면 최신 전환이 이어받는다', async () => {
    const ui = await render(<Harness screen="myRoom" />);
    await ui.rerender(<Harness screen="settings" />);
    await ui.rerender(<Harness screen="theme" />);
    // settings(층 b)가 떠나고 theme이 층 a로.
    expect(ui.getByTestId('layer-a')).toHaveTextContent('screen:theme');
    expect(ui.getByTestId('layer-b')).toHaveTextContent('screen:settings');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(ui.getByTestId('layer-b')).toBeEmptyElement();
  });

  it('isBackTransition — 백맵·연 곳 복귀·서브→탭', () => {
    expect(isBackTransition('theme', 'settings', 'routineManage')).toBe(true);
    expect(isBackTransition('addRoutine', 'routineManage', 'routineManage')).toBe(true);
    expect(isBackTransition('settings', 'myPage', 'routineManage')).toBe(true);
    expect(isBackTransition('settings', 'theme', 'routineManage')).toBe(false);
  });
});
