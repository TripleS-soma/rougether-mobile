import { act, fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';

import {
  CinematicRevealShell,
  CinematicRewardStage,
} from '@/components/screens/gacha/cinematic-reveal';
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

const entry = buildRevealPlan([
  {
    name: '숲의 작은 침대',
    rarity: '전설',
    assetKey: 'items/forest-sage/furniture/forest-sage-bed.png',
  },
]).items[0];

describe('CinematicRevealShell', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    video.__resetVideoPlayerMock();
    setHapticStrength('medium');
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('waits for alpha artwork, samples video time, and completes once when playback ends', async () => {
    const onComplete = jest.fn();
    const screen = await render(
      <CinematicRevealShell entry={entry} profile={entry.profile} onComplete={onComplete} />,
    );
    const player = video.__getLastVideoPlayer()!;
    expect(player.play).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('gacha-reward-art-0'), 'display');
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.replace).not.toHaveBeenCalled();
    await act(() => {
      player.__emit('timeUpdate', { currentTime: 0.74 });
      player.__emit('timeUpdate', { currentTime: 1.56 });
      player.__emit('timeUpdate', { currentTime: 1.8 });
    });
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Light);
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Heavy);
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(3, Haptics.ImpactFeedbackStyle.Medium);
    await act(() => {
      player.__emit('playToEnd');
      player.__emit('playToEnd');
      jest.runOnlyPendingTimers();
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('finished');
    expect(player.muted).toBe(true);
    expect(screen.queryByTestId('gacha-reveal-video-legendary')).toBeNull();
    await screen.unmount();
  });

  it('changes the sound setting without restarting or reloading the video', async () => {
    const screen = await render(
      <CinematicRevealShell profile={entry.profile} soundEffectsEnabled />,
    );
    const player = video.__getLastVideoPlayer()!;
    expect(player.play).toHaveBeenCalledTimes(1);
    await screen.rerender(
      <CinematicRevealShell profile={entry.profile} soundEffectsEnabled={false} />,
    );
    expect(video.__getLastVideoPlayer()).toBe(player);
    expect(player.muted).toBe(true);
    expect(player.volume).toBe(0);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.replace).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it('constrains the playing video to the stage instead of its intrinsic media dimensions', async () => {
    const screen = await render(<CinematicRevealShell profile={entry.profile} />);
    await fireEvent(screen.getByTestId('gacha-cinematic-reveal'), 'layout', {
      nativeEvent: { layout: { width: 402, height: 874 } },
    });
    const movie = screen.getByTestId('gacha-reveal-video-legendary');
    expect(StyleSheet.flatten(movie.props.style)).toMatchObject({
      position: 'absolute',
      width: '100%',
      height: '100%',
    });
    expect(movie.props.contentFit).toBe('cover');
    await screen.unmount();
  });

  it('uses a transparent fallback if artwork cannot arrive, rather than blocking the result', async () => {
    const screen = await render(<CinematicRevealShell entry={entry} profile={entry.profile} />);
    const player = video.__getLastVideoPlayer()!;
    await act(() => jest.advanceTimersByTime(1800));
    expect(screen.getByTestId('gacha-reward-fallback-0')).toBeTruthy();
    expect(screen.queryByTestId('gacha-reward-art-0')).toBeNull();
    expect(player.play).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });

  it('keeps artwork and haptics still while the video clock is buffering', async () => {
    const screen = await render(<CinematicRevealShell profile={entry.profile} />);
    const player = video.__getLastVideoPlayer()!;
    await act(() => {
      player.__emit('timeUpdate', { currentTime: 0.71 });
      jest.advanceTimersByTime(1500);
    });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await act(() => player.__emit('timeUpdate', { currentTime: 0.74 }));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });

  it('stops sound, subscriptions, fallback timers, and haptics on skip/unmount', async () => {
    const onComplete = jest.fn();
    const screen = await render(
      <CinematicRevealShell profile={entry.profile} onComplete={onComplete} />,
    );
    const player = video.__getLastVideoPlayer()!;
    await screen.unmount();
    expect(player.pause).toHaveBeenCalled();
    expect(player.__snapshot()).toMatchObject({
      muted: true,
      released: true,
      accessesAfterRelease: 0,
    });
    expect(player.__snapshot().lifecycle.slice(-5)).toEqual([
      'remove:timeUpdate',
      'remove:playToEnd',
      'remove:statusChange',
      'pause',
      'release',
    ]);
    expect(player.__listenerCount()).toBe(0);
    await act(() => {
      player.__emit('timeUpdate', { currentTime: 1.56 });
      player.__emit('playToEnd');
      jest.runOnlyPendingTimers();
    });
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('releases the native player safely when reduced motion replaces a playing video', async () => {
    const screen = await render(<CinematicRevealShell profile={entry.profile} />);
    const player = video.__getLastVideoPlayer()!;
    await screen.rerender(<CinematicRevealShell profile={entry.profile} reducedMotion />);
    expect(player.__snapshot()).toMatchObject({
      released: true,
      muted: true,
      accessesAfterRelease: 0,
    });
    expect(player.__listenerCount()).toBe(0);
    expect(screen.getByTestId('gacha-cinematic-stage')).toBeTruthy();
    await screen.unmount();
  });

  it('finishes and releases safely when its completion callback immediately removes the shell', async () => {
    function ResultTransition() {
      const [revealing, setRevealing] = useState(true);
      return revealing ? (
        <CinematicRevealShell profile={entry.profile} onComplete={() => setRevealing(false)} />
      ) : null;
    }
    const screen = await render(<ResultTransition />);
    const player = video.__getLastVideoPlayer()!;
    await act(() => player.__emit('playToEnd'));
    expect(player.__snapshot()).toMatchObject({
      released: true,
      muted: true,
      accessesAfterRelease: 0,
    });
    expect(player.__listenerCount()).toBe(0);
    await screen.unmount();
  });

  it.each(['error', 'timeout'] as const)(
    'shows the poster result if playback fails: %s',
    async (reason) => {
      const onComplete = jest.fn();
      const screen = await render(
        <CinematicRevealShell entry={entry} profile={entry.profile} onComplete={onComplete} />,
      );
      const player = video.__getLastVideoPlayer()!;
      await act(() => {
        if (reason === 'error') player.__emit('statusChange', { status: 'error' });
        else jest.advanceTimersByTime(8000);
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(reason);
      expect(player.muted).toBe(true);
      expect(screen.queryByTestId('gacha-reveal-video-legendary')).toBeNull();
      await screen.unmount();
    },
  );

  it('ends quietly on background and does not resume old haptics', async () => {
    let onAppState: (state: AppStateStatus) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onAppState = listener;
      return { remove };
    });
    const onComplete = jest.fn();
    const screen = await render(
      <CinematicRevealShell profile={entry.profile} onComplete={onComplete} />,
    );
    const player = video.__getLastVideoPlayer()!;
    await act(() => {
      onAppState('background');
      onAppState('active');
      player.__emit('timeUpdate', { currentTime: 1.56 });
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('background');
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(player.play).toHaveBeenCalledTimes(1);
    await screen.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('honors the global haptic strength gate', async () => {
    setHapticStrength('off');
    const screen = await render(<CinematicRevealShell profile={entry.profile} />);
    const player = video.__getLastVideoPlayer()!;
    await act(() => player.__emit('timeUpdate', { currentTime: 1.56 }));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it('creates no player, audio, or haptics for reduced motion', async () => {
    const onComplete = jest.fn();
    const screen = await render(
      <CinematicRevealShell
        entry={entry}
        profile={entry.profile}
        reducedMotion
        onComplete={onComplete}
      />,
    );
    expect(video.__getLastVideoPlayer()).toBeNull();
    expect(screen.getByTestId('gacha-cinematic-stage')).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('reduced-motion');
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it('keeps the final art alpha-only in the same crop-corrected stage', async () => {
    const screen = await render(<CinematicRewardStage entry={entry} tier="legendary" />);
    await fireEvent(screen.getByTestId('gacha-cinematic-stage'), 'layout', {
      nativeEvent: { layout: { width: 390, height: 844 } },
    });
    const art = screen.getByTestId('gacha-reward-art-0');
    expect(art.props.transition).toEqual({ duration: 0 });
    expect(art.props.contentFit).toBe('contain');
    expect(art.props.style.backgroundColor).toBeUndefined();
    await screen.unmount();
  });
});
