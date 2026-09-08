import { act, fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { MultiReveal } from '@/components/screens/gacha/multi-reveal';
import { getMultiRevealBeatMs } from '@/components/screens/gacha/multi-reveal-timeline';
import { spyAppState } from '@/test-utils/app-state';
import { buildRevealPlan } from '@/components/screens/gacha/reveal-motion';
import { setHapticStrength } from '@/utils/haptics';

type Player = {
  muted: boolean;
  volume: number;
  play: jest.Mock;
  pause: jest.Mock;
  replace: jest.Mock;
  __emit: (name: string, payload?: unknown) => void;
  __listenerCount: () => number;
  __snapshot: () => {
    muted: boolean;
    released: boolean;
    accessesAfterRelease: number;
    lifecycle: string[];
  };
};
const video = jest.requireActual('expo-video') as {
  __getLastVideoPlayer: () => Player | null;
  __resetVideoPlayerMock: () => void;
};
const plan = buildRevealPlan(
  ['일반', '희귀', '일반', '전설', '일반', '희귀'].map((rarity, index) => ({
    name: `가구 ${index + 1}`,
    rarity,
  })),
);
const assetPlan = buildRevealPlan(
  plan.items.map(({ result }, index) => ({
    ...result,
    assetKey: `items/forest-sage/furniture/forest-sage-${index}.png`,
  })),
);

describe('MultiReveal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    video.__resetVideoPlayerMock();
    setHapticStrength('medium');
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reveals one real result per chime before completing after the sixth settles', async () => {
    const onComplete = jest.fn();
    const screen = await render(<MultiReveal plan={plan} onComplete={onComplete} />);
    const player = video.__getLastVideoPlayer()!;
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByLabelText(/^가구 /)).toHaveLength(0);
    expect(
      screen.getByTestId('gacha-multi-art-slot-0', { includeHiddenElements: true }).props[
        'aria-hidden'
      ],
    ).toBe(true);
    for (let index = 0; index < 6; index++) {
      await act(() =>
        player.__emit('timeUpdate', { currentTime: (getMultiRevealBeatMs(index) + 10) / 1000 }),
      );
      expect(screen.queryAllByLabelText(/^가구 /)).toHaveLength(index + 1);
      expect(screen.getByLabelText(`가구 ${index + 1}`)).toBeTruthy();
      expect(screen.getByTestId(`gacha-multi-art-slot-${index}`).props['aria-hidden']).toBe(false);
      expect(onComplete).not.toHaveBeenCalled();
    }
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(6);
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(4, Haptics.ImpactFeedbackStyle.Heavy);
    await act(() => player.__emit('timeUpdate', { currentTime: 4.299 }));
    expect(onComplete).not.toHaveBeenCalled();
    await act(() => {
      player.__emit('timeUpdate', { currentTime: 4.3 });
      player.__emit('playToEnd');
      jest.runOnlyPendingTimers();
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('finished');
    expect(player.muted).toBe(true);
    expect(screen.queryByTestId('gacha-multi-reveal-video')).toBeNull();
    await screen.unmount();
  });

  it('waits for all six alpha images without exposing their identities', async () => {
    const screen = await render(<MultiReveal plan={assetPlan} />);
    const player = video.__getLastVideoPlayer()!;
    for (let index = 0; index < 6; index++) {
      expect(player.play).not.toHaveBeenCalled();
      expect(screen.queryAllByLabelText(/^가구 /)).toHaveLength(0);
      await fireEvent(
        screen.getByTestId(`gacha-reward-art-${index}`, { includeHiddenElements: true }),
        'display',
      );
    }
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.replace).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it('uses transparent fallback only for missing artwork at the load deadline', async () => {
    const screen = await render(<MultiReveal plan={assetPlan} />);
    const player = video.__getLastVideoPlayer()!;
    await fireEvent(
      screen.getByTestId('gacha-reward-art-0', { includeHiddenElements: true }),
      'display',
    );
    await act(() => jest.advanceTimersByTime(1800));
    expect(screen.getByTestId('gacha-reward-art-0', { includeHiddenElements: true })).toBeTruthy();
    expect(
      screen.getByTestId('gacha-reward-fallback-1', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByLabelText(/^가구 /)).toHaveLength(0);
    await screen.unmount();
  });

  it('freezes visuals on stalled or rewound media time without queued haptic bursts', async () => {
    const onComplete = jest.fn();
    const screen = await render(<MultiReveal plan={plan} onComplete={onComplete} />);
    const player = video.__getLastVideoPlayer()!;
    await act(() => player.__emit('timeUpdate', { currentTime: 0.7 }));
    expect(screen.queryAllByLabelText(/^가구 /)).toHaveLength(1);
    await act(() => {
      jest.advanceTimersByTime(1500);
      player.__emit('timeUpdate', { currentTime: 0.1 });
      player.__emit('timeUpdate', { currentTime: NaN });
    });
    expect(screen.queryAllByLabelText(/^가구 /)).toHaveLength(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    await act(() => player.__emit('timeUpdate', { currentTime: 2.9 }));
    expect(screen.queryAllByLabelText(/^가구 /)).toHaveLength(5);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });

  it('updates the effects mute toggle without restarting the six-beat track', async () => {
    const screen = await render(<MultiReveal plan={plan} soundEffectsEnabled={false} />);
    const player = video.__getLastVideoPlayer()!;
    expect(player.muted).toBe(true);
    expect(player.volume).toBe(0);
    await screen.rerender(<MultiReveal plan={plan} soundEffectsEnabled />);
    expect(player.muted).toBe(false);
    expect(player.volume).toBe(0.86);
    await screen.rerender(<MultiReveal plan={plan} soundEffectsEnabled={false} />);
    expect(player.muted).toBe(true);
    expect(player.volume).toBe(0);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.replace).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it.each([320, 393])('fits the video and actual art slots to a %spx phone', async (width) => {
    const screen = await render(<MultiReveal plan={plan} />);
    await fireEvent(screen.getByTestId('gacha-multi-reveal'), 'layout', {
      nativeEvent: { layout: { width, height: 700 } },
    });
    const movie = screen.getByTestId('gacha-multi-reveal-video');
    expect(StyleSheet.flatten(movie.props.style)).toMatchObject({ width: '100%', height: '100%' });
    expect(movie.props.contentFit).toBe('cover');
    for (let index = 0; index < 6; index++) {
      const style = StyleSheet.flatten(
        screen.getByTestId(`gacha-multi-art-slot-${index}`, { includeHiddenElements: true }).props
          .style,
      );
      expect(style.left).toBeGreaterThanOrEqual(24);
      expect(style.left + style.width).toBeLessThanOrEqual(width - 24);
      expect(style.backgroundColor).toBeUndefined();
    }
    await screen.unmount();
  });

  it.each([0, 1, 2, 5, 7, 10])(
    'does not fabricate six rewards or extra sounds for %s actual results',
    async (count) => {
      const onComplete = jest.fn();
      const supplied = buildRevealPlan(
        Array.from({ length: count }, (_, index) => ({ name: `실제 ${index}` })),
      );
      const screen = await render(<MultiReveal plan={supplied} onComplete={onComplete} />);
      expect(video.__getLastVideoPlayer()).toBeNull();
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith('error');
      expect(supplied.items).toHaveLength(count);
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
      await screen.unmount();
    },
  );

  it('creates no player, sound, or haptics when reduced motion is requested in the plan', async () => {
    const onComplete = jest.fn();
    const screen = await render(
      <MultiReveal plan={{ ...plan, reducedMotion: true }} onComplete={onComplete} />,
    );
    expect(video.__getLastVideoPlayer()).toBeNull();
    expect(onComplete).toHaveBeenCalledWith('reduced-motion');
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it('cleans up audio and listeners before player release when skipped/unmounted', async () => {
    const onComplete = jest.fn();
    const screen = await render(<MultiReveal plan={plan} onComplete={onComplete} />);
    const player = video.__getLastVideoPlayer()!;
    await screen.unmount();
    expect(player.__snapshot()).toMatchObject({
      muted: true,
      released: true,
      accessesAfterRelease: 0,
    });
    expect(player.__listenerCount()).toBe(0);
    expect(player.__snapshot().lifecycle.slice(-5)).toEqual([
      'remove:timeUpdate',
      'remove:playToEnd',
      'remove:statusChange',
      'pause',
      'release',
    ]);
    await act(() => {
      player.__emit('timeUpdate', { currentTime: 0.6 });
      player.__emit('playToEnd');
      jest.runOnlyPendingTimers();
    });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('safely releases a playing source when reduced motion turns on', async () => {
    const onComplete = jest.fn();
    const screen = await render(<MultiReveal plan={plan} onComplete={onComplete} />);
    const player = video.__getLastVideoPlayer()!;
    await screen.rerender(<MultiReveal plan={plan} reducedMotion onComplete={onComplete} />);
    expect(player.__snapshot()).toMatchObject({
      muted: true,
      released: true,
      accessesAfterRelease: 0,
    });
    expect(player.__listenerCount()).toBe(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('reduced-motion');
    await screen.unmount();
  });

  it.each(['error', 'timeout'] as const)(
    'falls through to real results once on %s',
    async (reason) => {
      const onComplete = jest.fn();
      const screen = await render(<MultiReveal plan={plan} onComplete={onComplete} />);
      const player = video.__getLastVideoPlayer()!;
      await act(() => {
        if (reason === 'error') player.__emit('statusChange', { status: 'error' });
        else jest.advanceTimersByTime(9100);
        player.__emit('playToEnd');
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(reason);
      expect(player.muted).toBe(true);
      expect(screen.queryByTestId('gacha-multi-reveal-video')).toBeNull();
      await screen.unmount();
    },
  );

  it('completes quietly on background and never replays when the app resumes', async () => {
    const appState = spyAppState();
    const onComplete = jest.fn();
    const screen = await render(<MultiReveal plan={plan} onComplete={onComplete} />);
    const player = video.__getLastVideoPlayer()!;
    await act(() => {
      appState.emit('background');
      appState.emit('active');
      player.__emit('timeUpdate', { currentTime: 0.6 });
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('background');
    expect(player.muted).toBe(true);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await screen.unmount();
    expect(appState.removes[0]).toHaveBeenCalled();
  });

  it('safely releases when finishing immediately unmounts the cinematic', async () => {
    function Transition() {
      const [playing, setPlaying] = useState(true);
      return playing ? <MultiReveal plan={plan} onComplete={() => setPlaying(false)} /> : null;
    }
    const screen = await render(<Transition />);
    const player = video.__getLastVideoPlayer()!;
    await act(() => player.__emit('timeUpdate', { currentTime: 4.3 }));
    expect(player.__snapshot()).toMatchObject({
      muted: true,
      released: true,
      accessesAfterRelease: 0,
    });
    expect(player.__listenerCount()).toBe(0);
    await screen.unmount();
  });

  it('respects the existing global haptic-off gate', async () => {
    setHapticStrength('off');
    const screen = await render(<MultiReveal plan={plan} />);
    const player = video.__getLastVideoPlayer()!;
    await act(() => player.__emit('timeUpdate', { currentTime: 0.6 }));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await screen.unmount();
  });
});
