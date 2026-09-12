/** @jest-environment jsdom */
import { act, type ReactNode } from 'react';

import { RunnerGame } from '@/components/minigame/runner-game.web';
import { StairsGame } from '@/components/minigame/stairs-game.web';
import { MergeGame } from '@/components/minigame/merge-game.web';

type Root = { render: (children: ReactNode) => void; unmount: () => void };
const { createRoot } = jest.requireActual('react-dom/client') as {
  createRoot: (container: Element) => Root;
};

jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    View: ({ children }: { children: unknown }) => React.createElement('div', null, children),
  };
});
jest.mock('@/hooks/use-tokens', () => ({ useTokens: () => ({}) }));
jest.mock('@/components/minigame/game-recovery', () => ({
  GameRecovery: ({ error, onRetry }: { error: string; onRetry: () => void }) => {
    const React = jest.requireActual('react');
    return React.createElement('button', { onClick: onRetry }, error);
  },
}));
jest.mock('@/features/minigame/runner-html', () => ({
  createRunnerHtml: (config: unknown) => JSON.stringify(config),
}));
jest.mock('@/features/minigame/stairs-html', () => ({
  createStairsHtml: (config: unknown) => JSON.stringify(config),
}));
jest.mock('@/features/minigame/merge-html', () => ({
  createMergeHtml: (config: unknown) => JSON.stringify(config),
}));

const games = [
  { name: 'runner', Component: RunnerGame, result: { ticks: 10, jumpTicks: [] } },
  { name: 'stairs', Component: StairsGame, result: { ticks: 10, actions: [] } },
  { name: 'merge', Component: MergeGame, result: { ticks: 10, actions: [] } },
];

describe.each(games)('$name web recovery', ({ Component, result }) => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('ignores outside sources/channels and retries the same seed after a bad current finish', async () => {
    const onFinish = jest.fn();
    await act(async () =>
      root.render(<Component seed={42} practice={false} onFinish={onFinish} />),
    );
    const frame = container.querySelector('iframe')!;
    const { channelId } = JSON.parse(frame.srcdoc);
    const send = (source: Window | null, channel: string, replay: object) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          source,
          data: { channelId: channel, type: 'finish', result: replay },
        }),
      );
    await act(async () => {
      send(window, channelId, {});
      send(frame.contentWindow, 'another-channel', {});
    });
    expect(container.querySelector('button')).toBeNull();
    await act(async () => {
      send(frame.contentWindow, channelId, {});
    });
    expect(container.querySelector('button')?.textContent).toBe('finish');
    expect(onFinish).not.toHaveBeenCalled();
    await act(async () => container.querySelector('button')!.click());
    const restarted = container.querySelector('iframe')!;
    const next = JSON.parse(restarted.srcdoc);
    expect(next).toMatchObject({ seed: 42, practice: false });
    expect(next.channelId).not.toBe(channelId);
    await act(async () => {
      send(restarted.contentWindow, channelId, result);
      send(window, next.channelId, result);
    });
    expect(onFinish).not.toHaveBeenCalled();
    await act(async () => {
      send(restarted.contentWindow, next.channelId, result);
      send(restarted.contentWindow, next.channelId, result);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(result);
  });
});
