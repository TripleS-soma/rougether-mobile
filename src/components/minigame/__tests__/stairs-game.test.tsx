import { render } from '@testing-library/react-native';
import { act } from 'react';
import { AppState } from 'react-native';

import { StairsGame } from '@/components/minigame/stairs-game';
import { createStairsHtml } from '@/features/minigame/stairs-html';

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

jest.mock('@/features/minigame/stairs-html', () => ({
  createStairsHtml: jest.fn((config: unknown) => JSON.stringify(config)),
}));

describe('StairsGame lifecycle bridge', () => {
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
      <StairsGame seed={42} onFinish={jest.fn()} />,
    );
    const game = getByTestId('stairs-game');
    const { channelId } = JSON.parse(game.props.source.html);
    await act(async () => appStateChanged('background'));
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setStairsActive && window.setStairsActive(false); true;',
    );
    await act(async () => {
      game.props.onMessage({ nativeEvent: { data: JSON.stringify({ channelId, type: 'ready' }) } });
    });
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setStairsActive && window.setStairsActive(false); true;',
    );
    await rerender(<StairsGame seed={42} active={false} onFinish={jest.fn()} />);
    await act(async () => appStateChanged('active'));
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setStairsActive && window.setStairsActive(false); true;',
    );
    await rerender(<StairsGame seed={42} active onFinish={jest.fn()} />);
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setStairsActive && window.setStairsActive(true); true;',
    );
    await unmount();
    expect(removeAppStateListener).toHaveBeenCalled();
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setStairsActive && window.setStairsActive(false); window.destroyStairs && window.destroyStairs(); true;',
    );
  });

  it('rejects invalid messages and delivers a valid finish only once per seed', async () => {
    const onFinish = jest.fn();
    const onPauseChange = jest.fn();
    const { getByTestId, rerender } = await render(
      <StairsGame seed={42} onFinish={onFinish} onPauseChange={onPauseChange} />,
    );
    const game = getByTestId('stairs-game');
    const { channelId } = JSON.parse(game.props.source.html);
    const result = {
      ticks: 120,
      actions: [
        { tick: 25, direction: 'LEFT' },
        { tick: 70, direction: 'RIGHT' },
      ],
    };
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
    expect(onFinish).toHaveBeenCalledWith(result);

    await rerender(<StairsGame seed={43} onFinish={onFinish} />);
    const nextGame = getByTestId('stairs-game');
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
      <StairsGame seed={42} onFinish={jest.fn()} />,
    );
    const source = getByTestId('stairs-game').props.source;
    expect(getByLabelText('고양이 계단 오르기')).toBeTruthy();
    expect(JSON.parse(source.html).allowManualTime).toBe(false);
    await rerender(<StairsGame seed={42} active={false} onFinish={jest.fn()} />);
    expect(getByTestId('stairs-game').props.source).toBe(source);
    expect(createStairsHtml).toHaveBeenCalledTimes(1);
  });

  it('allows only the inline game document to navigate', async () => {
    const { getByTestId } = await render(<StairsGame seed={42} onFinish={jest.fn()} />);
    const shouldLoad = getByTestId('stairs-game').props.onShouldStartLoadWithRequest;
    expect(shouldLoad({ url: 'about:blank' })).toBe(true);
    expect(shouldLoad({ url: 'https://example.com' })).toBe(false);
    expect(shouldLoad({ url: 'rougether://room' })).toBe(false);
    expect(shouldLoad({ url: 'javascript:alert(1)' })).toBe(false);
  });
});
