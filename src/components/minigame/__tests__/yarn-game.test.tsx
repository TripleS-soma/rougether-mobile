import { render } from '@testing-library/react-native';
import { act } from 'react';
import { AppState } from 'react-native';

import { YarnGame } from '@/components/minigame/yarn-game';
import { createYarnHtml } from '@/features/minigame/yarn-html';

const mockInjectJavaScript = jest.fn();

jest.mock('react-native-webview', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    WebView: React.forwardRef(function MockWebView(props: object, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInjectJavaScript }));
      return React.createElement(View, props);
    }),
  };
});

const mockPlayGameFx = jest.fn();
jest.mock('@/features/minigame/game-fx', () => ({
  ...jest.requireActual('@/features/minigame/game-fx'),
  playGameFx: (kind: string) => mockPlayGameFx(kind),
}));

jest.mock('@/features/minigame/yarn-html', () => ({
  createYarnHtml: jest.fn((config: unknown) => JSON.stringify(config)),
}));

describe('YarnGame lifecycle bridge', () => {
  let appStateChanged: (state: string) => void;
  const removeAppStateListener = jest.fn();

  beforeEach(() => {
    (AppState as { currentState: string }).currentState = 'active';
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      listener: (state: string) => void,
    ) => {
      appStateChanged = listener;
      return { remove: removeAppStateListener };
    }) as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('pauses in the background, synchronizes readiness, and disposes the game on unmount', async () => {
    const { getByTestId, rerender, unmount } = await render(
      <YarnGame seed={42} onFinish={jest.fn()} />,
    );
    const game = getByTestId('yarn-game');
    const { channelId } = JSON.parse(game.props.source.html);
    await act(async () => appStateChanged('background'));
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setYarnActive && window.setYarnActive(false); true;',
    );
    await act(async () => {
      game.props.onMessage({ nativeEvent: { data: JSON.stringify({ channelId, type: 'ready' }) } });
    });
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setYarnActive && window.setYarnActive(false); true;',
    );
    await rerender(<YarnGame seed={42} active={false} onFinish={jest.fn()} />);
    await act(async () => appStateChanged('active'));
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setYarnActive && window.setYarnActive(false); true;',
    );
    await rerender(<YarnGame seed={42} active onFinish={jest.fn()} />);
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setYarnActive && window.setYarnActive(true); true;',
    );
    await unmount();
    expect(removeAppStateListener).toHaveBeenCalled();
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setYarnActive && window.setYarnActive(false); window.destroyYarn && window.destroyYarn(); true;',
    );
  });

  it('rejects invalid messages and delivers a valid finish only once per seed', async () => {
    const onFinish = jest.fn();
    const onPauseChange = jest.fn();
    const { getByTestId, rerender } = await render(
      <YarnGame seed={42} onFinish={onFinish} onPauseChange={onPauseChange} />,
    );
    const game = getByTestId('yarn-game');
    const { channelId } = JSON.parse(game.props.source.html);
    const result = { ticks: 3, picks: [0, 5, 2] };
    const send = (value: unknown) =>
      game.props.onMessage({
        nativeEvent: { data: typeof value === 'string' ? value : JSON.stringify(value) },
      });

    await act(async () => {
      send('not JSON');
      send({ channelId: 'another-game', type: 'finish', result });
      send({ channelId, type: 'pause', paused: 'true' });
    });
    expect(onFinish).not.toHaveBeenCalled();
    expect(onPauseChange).not.toHaveBeenCalled();
    await act(async () => {
      send({ channelId, type: 'pause', paused: true });
      send({ channelId, type: 'pause', paused: false });
      send({ channelId, type: 'finish', result });
      send({ channelId, type: 'finish', result });
    });
    expect(onPauseChange.mock.calls).toEqual([[true], [false]]);
    expect(onFinish).toHaveBeenCalledTimes(1);
    // 집은 더미 순서(picks)가 그대로 서버 제출 형태다.
    expect(onFinish).toHaveBeenCalledWith({ ticks: 3, picks: [0, 5, 2] });

    await rerender(<YarnGame seed={43} onFinish={onFinish} />);
    const nextGame = getByTestId('yarn-game');
    const nextChannelId = JSON.parse(nextGame.props.source.html).channelId;
    expect(nextChannelId).not.toBe(channelId);
    await act(async () => {
      nextGame.props.onMessage({
        nativeEvent: { data: JSON.stringify({ channelId, type: 'finish', result }) },
      });
      nextGame.props.onMessage({
        nativeEvent: { data: JSON.stringify({ channelId: nextChannelId, type: 'finish', result }) },
      });
    });
    expect(onFinish).toHaveBeenCalledTimes(2);
  });

  it('keeps the document stable when parent callbacks or activity change', async () => {
    const { getByTestId, rerender, getByLabelText } = await render(
      <YarnGame seed={42} onFinish={jest.fn()} />,
    );
    const source = getByTestId('yarn-game').props.source;
    expect(getByLabelText('고양이 털실 정리')).toBeTruthy();
    expect(JSON.parse(source.html).practice).toBe(false);
    await rerender(<YarnGame seed={42} active={false} onFinish={jest.fn()} />);
    expect(getByTestId('yarn-game').props.source).toBe(source);
    expect(createYarnHtml).toHaveBeenCalledTimes(1);
  });

  it('plays drop haptics from fx messages without touching the game result', async () => {
    const onFinish = jest.fn();
    const { getByTestId } = await render(<YarnGame seed={42} onFinish={onFinish} />);
    const game = getByTestId('yarn-game');
    const { channelId } = JSON.parse(game.props.source.html);
    const send = (value: object) =>
      game.props.onMessage({ nativeEvent: { data: JSON.stringify(value) } });
    await act(async () => {
      send({ channelId, type: 'fx', kind: 'merge' });
      send({ channelId, type: 'fx', kind: 'over' });
      send({ channelId: 'another-game', type: 'fx', kind: 'step' });
      send({ channelId, type: 'fx', kind: 'explode' });
    });
    expect(mockPlayGameFx.mock.calls).toEqual([['merge'], ['over']]);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('allows only the inline game document to navigate', async () => {
    const { getByTestId } = await render(<YarnGame seed={42} onFinish={jest.fn()} />);
    const shouldLoad = getByTestId('yarn-game').props.onShouldStartLoadWithRequest;
    expect(shouldLoad({ url: 'about:blank' })).toBe(true);
    expect(shouldLoad({ url: 'https://example.com' })).toBe(false);
    expect(shouldLoad({ url: 'rougether://room' })).toBe(false);
    expect(shouldLoad({ url: 'javascript:alert(1)' })).toBe(false);
  });
});
