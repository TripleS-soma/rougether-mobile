import { render } from '@testing-library/react-native';
import { act } from 'react';
import { AppState } from 'react-native';

import { RhythmGame } from '@/components/minigame/rhythm-game';

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

jest.mock('@/features/minigame/rhythm-html', () => ({
  createRhythmHtml: jest.fn((config: unknown) => JSON.stringify(config)),
}));

describe('RhythmGame lifecycle bridge', () => {
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
    const { getByTestId, rerender, unmount } = await render(<RhythmGame onFinish={jest.fn()} />);
    const game = getByTestId('rhythm-game');
    const { channelId } = JSON.parse(game.props.source.html);
    await act(async () => appStateChanged('background'));
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setRhythmActive && window.setRhythmActive(false); true;',
    );
    await act(async () => {
      game.props.onMessage({ nativeEvent: { data: JSON.stringify({ channelId, type: 'ready' }) } });
    });
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setRhythmActive && window.setRhythmActive(false); true;',
    );
    await rerender(<RhythmGame active={false} onFinish={jest.fn()} />);
    await act(async () => appStateChanged('active'));
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setRhythmActive && window.setRhythmActive(false); true;',
    );
    await rerender(<RhythmGame active onFinish={jest.fn()} />);
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setRhythmActive && window.setRhythmActive(true); true;',
    );
    await unmount();
    expect(removeAppStateListener).toHaveBeenCalled();
    expect(mockInjectJavaScript).toHaveBeenLastCalledWith(
      'window.setRhythmActive && window.setRhythmActive(false); window.destroyRhythm && window.destroyRhythm(); true;',
    );
  });
});
