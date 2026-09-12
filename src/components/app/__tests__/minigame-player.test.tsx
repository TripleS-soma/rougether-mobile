import { act, fireEvent, render } from '@testing-library/react-native';

import { MinigamePlayer } from '@/components/app/minigame-player';
import type { MinigameCode } from '@/constants/minigames';

jest.mock('react-native-webview', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    WebView: React.forwardRef(function MockWebView(props: object, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
      return React.createElement(View, props);
    }),
  };
});
jest.mock('@/features/minigame/runner-html', () => ({
  createRunnerHtml: (config: unknown) => JSON.stringify(config),
}));
jest.mock('@/features/minigame/stairs-html', () => ({
  createStairsHtml: (config: unknown) => JSON.stringify(config),
}));
jest.mock('@/features/minigame/merge-html', () => ({
  createMergeHtml: (config: unknown) => JSON.stringify(config),
}));

const games: { code: MinigameCode; label: string; result: object }[] = [
  { code: 'room-runner', label: '러너 게임', result: { ticks: 30, jumpTicks: [2] } },
  {
    code: 'cat-stairs',
    label: '고양이 계단 오르기',
    result: { ticks: 30, actions: [{ tick: 2, direction: 'LEFT' }] },
  },
  {
    code: 'cat-merge',
    label: '고양이 합치기',
    result: { ticks: 30, actions: [{ tick: 2, direction: 'DOWN' }] },
  },
];

describe.each(games)('MinigamePlayer $code', ({ code, label, result }) => {
  it('routes to the real renderer and forwards its validated replay once', async () => {
    const onFinish = jest.fn();
    const { getByLabelText } = await render(
      <MinigamePlayer gameCode={code} seed={42} active={false} practice onFinish={onFinish} />,
    );
    const game = getByLabelText(label);
    const config = JSON.parse(game.props.source.html);
    expect(config).toMatchObject({ seed: 42, practice: true });
    await act(async () => {
      const event = {
        nativeEvent: {
          data: JSON.stringify({ channelId: config.channelId, type: 'finish', result }),
        },
      };
      game.props.onMessage(event);
      game.props.onMessage(event);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(result);
  });

  it('ignores foreign messages and recovers a malformed current finish with the same seed', async () => {
    const onFinish = jest.fn();
    const { getByLabelText, getByText, queryByText } = await render(
      <MinigamePlayer gameCode={code} seed={42} active practice={false} onFinish={onFinish} />,
    );
    const game = getByLabelText(label);
    const { channelId } = JSON.parse(game.props.source.html);
    const send = (channel: string, replay: object) =>
      game.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({ channelId: channel, type: 'finish', result: replay }),
        },
      });
    await act(async () => send('another-channel', {}));
    expect(queryByText('게임 기록을 확인하지 못했어요.')).toBeNull();
    await act(async () => send(channelId, {}));
    expect(getByText('게임 기록을 확인하지 못했어요.')).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
    await fireEvent.press(getByLabelText('다시 시작'));
    const restarted = getByLabelText(label);
    const next = JSON.parse(restarted.props.source.html);
    expect(next).toMatchObject({ seed: 42, practice: false });
    expect(next.channelId).not.toBe(channelId);
    await act(async () => {
      // A queued event may still invoke the callback captured by the disposed WebView.
      send(channelId, result);
      game.props.onError({ nativeEvent: {} });
      restarted.props.onMessage({
        nativeEvent: { data: JSON.stringify({ channelId, type: 'finish', result }) },
      });
    });
    expect(queryByText('게임을 불러오지 못했어요.')).toBeNull();
    expect(onFinish).not.toHaveBeenCalled();
    await act(async () => {
      restarted.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({ channelId: next.channelId, type: 'finish', result }),
        },
      });
    });
    expect(onFinish).toHaveBeenCalledWith(result);
  });

  it.each(['onError', 'onContentProcessDidTerminate', 'onRenderProcessGone'])(
    'recovers native document failure via %s',
    async (event) => {
      const onFinish = jest.fn();
      const { getByLabelText, getByText } = await render(
        <MinigamePlayer gameCode={code} seed={55} active practice onFinish={onFinish} />,
      );
      const game = getByLabelText(label);
      const original = JSON.parse(game.props.source.html);
      await act(async () => game.props[event]({ nativeEvent: {} }));
      expect(getByText('게임을 불러오지 못했어요.')).toBeTruthy();
      await fireEvent.press(getByLabelText('다시 시작'));
      const restarted = JSON.parse(getByLabelText(label).props.source.html);
      expect(restarted).toMatchObject({ seed: 55, practice: true });
      expect(restarted.channelId).not.toBe(original.channelId);
      expect(onFinish).not.toHaveBeenCalled();
    },
  );
});
