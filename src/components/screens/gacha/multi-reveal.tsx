import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { CinematicCompletionReason } from '@/components/screens/gacha/cinematic-reveal';
import {
  createMultiRevealCueTracker,
  getMultiRevealArtFrame,
  getMultiRevealDuration,
  getMultiRevealLayout,
  MULTI_REVEAL_TIMING,
  type MultiRevealCue,
} from '@/components/screens/gacha/multi-reveal-timeline';
import { rarityColor, RewardArtwork } from '@/components/screens/gacha/reward-artwork';
import type { RevealPlan, RevealPlanItem } from '@/components/screens/gacha/reveal-motion';
import { GachaSceneColors, Radius, Spacing } from '@/constants/theme';
import { useAnimatedValue, useConstant, useLatestRef } from '@/hooks/use-stable-value';
import { hapticImpact } from '@/utils/haptics';

import multiVideo from '@/assets/videos/gacha-reveal-multi.mp4';

export type MultiRevealProps = {
  plan: RevealPlan;
  soundEffectsEnabled?: boolean;
  reducedMotion?: boolean;
  onComplete?: (reason: CinematicCompletionReason) => void;
};

/** Never invent six slots for a partial/changed API response. Show the actual results instead. */
export function MultiReveal(props: MultiRevealProps) {
  const reduced = props.reducedMotion ?? props.plan.reducedMotion;
  return reduced || props.plan.items.length !== MULTI_REVEAL_TIMING.maxItems ? (
    <ImmediateResults {...props} reason={reduced ? 'reduced-motion' : 'error'} />
  ) : (
    <PlayingMultiReveal {...props} />
  );
}

function ImmediateResults({
  onComplete,
  reason,
}: MultiRevealProps & { reason: CinematicCompletionReason }) {
  const complete = useLatestRef(onComplete);
  const completed = useRef(false);
  useEffect(() => {
    if (completed.current) return;
    completed.current = true;
    complete.current?.(reason);
  }, [complete, reason]);
  return <View testID="gacha-multi-reveal-static" style={styles.stage} />;
}

const HAPTIC_STYLES: Record<MultiRevealCue['strength'], Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

function PlayingMultiReveal({ plan, soundEffectsEnabled = true, onComplete }: MultiRevealProps) {
  const draw = useConstant(() => plan);
  const viewport = useWindowDimensions();
  const [size, setSize] = useState({ width: viewport.width, height: viewport.height });
  const layout = getMultiRevealLayout(size.width, size.height, draw.items.length);
  const clock = useAnimatedValue(0);
  const loaded = useConstant(
    () => new Set(draw.items.filter((e) => e.renderKind !== 'asset').map((e) => e.index)),
  );
  const [artReady, setArtReady] = useState(loaded.size === draw.items.length);
  const [missing, setMissing] = useState<ReadonlySet<number>>(new Set());
  const [finished, setFinished] = useState(false);
  const completed = useRef(false);
  const started = useRef(false);
  const complete = useLatestRef(onComplete);
  const player = useVideoPlayer(multiVideo, (instance) => {
    instance.loop = false;
    instance.muted = !soundEffectsEnabled;
    instance.volume = soundEffectsEnabled ? 0.86 : 0;
    instance.timeUpdateEventInterval = 1 / 30;
    instance.staysActiveInBackground = false;
    instance.audioMixingMode = 'mixWithOthers';
  });

  // Layout cleanup runs before useVideoPlayer's passive native-object release.
  useLayoutEffect(() => {
    let disposed = false;
    let currentMs = 0;
    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    let artTimer: ReturnType<typeof setTimeout> | undefined;
    const duration = getMultiRevealDuration(draw.items.length);
    const cues = createMultiRevealCueTracker(draw.items);
    const stop = () => {
      player.muted = true;
      player.volume = 0;
      player.pause();
    };
    const finish = (reason: CinematicCompletionReason) => {
      if (disposed || completed.current) return;
      completed.current = true;
      clearTimeout(safetyTimer);
      clearTimeout(artTimer);
      stop();
      clock.setValue(duration);
      setFinished(true);
      complete.current?.(reason);
    };
    const subscriptions = [
      player.addListener('timeUpdate', ({ currentTime }) => {
        if (disposed || completed.current || !started.current || !Number.isFinite(currentTime))
          return;
        currentMs = Math.max(currentMs, currentTime * 1000);
        clock.setValue(currentMs);
        for (const cue of cues(currentMs)) hapticImpact(HAPTIC_STYLES[cue.strength]);
        if (currentMs >= duration) finish('finished');
      }),
      player.addListener('playToEnd', () => finish('finished')),
      player.addListener('statusChange', ({ status }) => {
        if (status === 'error') finish('error');
      }),
      AppState.addEventListener('change', (state) => {
        if (state === 'background' || state === 'inactive') finish('background');
      }),
    ];
    safetyTimer = setTimeout(
      () => finish('timeout'),
      MULTI_REVEAL_TIMING.artworkTimeoutMs + duration + MULTI_REVEAL_TIMING.playbackGraceMs,
    );
    artTimer = setTimeout(() => {
      if (disposed || completed.current || loaded.size === draw.items.length) return;
      setMissing(
        new Set(draw.items.filter((entry) => !loaded.has(entry.index)).map((entry) => entry.index)),
      );
      setArtReady(true);
    }, MULTI_REVEAL_TIMING.artworkTimeoutMs);
    if (AppState.currentState === 'background' || AppState.currentState === 'inactive')
      finish('background');
    else if (player.status === 'error') finish('error');
    return () => {
      disposed = true;
      started.current = false;
      clearTimeout(safetyTimer);
      clearTimeout(artTimer);
      subscriptions.forEach((subscription) => subscription.remove());
      stop();
    };
  }, [clock, complete, draw, loaded, player]);

  useEffect(() => {
    if (!artReady || started.current || completed.current) return;
    started.current = true;
    player.play();
  }, [artReady, player]);

  useEffect(() => {
    if (completed.current) return;
    player.muted = !soundEffectsEnabled;
    player.volume = soundEffectsEnabled ? 0.86 : 0;
  }, [player, soundEffectsEnabled]);

  return (
    <View
      style={styles.stage}
      pointerEvents="none"
      testID="gacha-multi-reveal"
      onLayout={({ nativeEvent: { layout: next } }) => {
        if (
          next.width > 0 &&
          next.height > 0 &&
          (next.width !== size.width || next.height !== size.height)
        )
          setSize({ width: next.width, height: next.height });
      }}>
      {!finished ? (
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="cover"
          playsInline
          surfaceType="textureView"
          style={styles.video}
          testID="gacha-multi-reveal-video"
        />
      ) : null}
      {draw.items.map((entry, index) => (
        <MultiArtwork
          key={index}
          entry={entry}
          clock={clock}
          slot={layout.slots[index]}
          size={layout.size}
          centerX={layout.centerX}
          centerY={layout.centerY}
          forceFallback={missing.has(entry.index)}
          onReady={() => {
            loaded.add(entry.index);
            if (loaded.size === draw.items.length) setArtReady(true);
          }}
        />
      ))}
    </View>
  );
}

function MultiArtwork({
  entry,
  clock,
  slot,
  size,
  centerX,
  centerY,
  onReady,
  forceFallback,
}: {
  entry: RevealPlanItem;
  clock: Animated.Value;
  slot: { left: number; top: number };
  size: number;
  centerX: number;
  centerY: number;
  onReady: () => void;
  forceFallback: boolean;
}) {
  const opacity = useAnimatedValue(0);
  const translateX = useAnimatedValue(0);
  const translateY = useAnimatedValue(0);
  const scale = useAnimatedValue(1);
  const rotation = useAnimatedValue(0);
  const accentOpacity = useAnimatedValue(0);
  const accentScale = useAnimatedValue(1);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const color = rarityColor(entry.badgeLabel);
  useLayoutEffect(() => {
    const listener = clock.addListener(({ value }) => {
      const frame = getMultiRevealArtFrame(entry.tier, entry.index, value);
      opacity.setValue(frame.opacity);
      scale.setValue(frame.scale);
      rotation.setValue(frame.rotation);
      translateX.setValue((centerX - slot.left - size / 2) * frame.centerWeight);
      translateY.setValue((centerY - slot.top - size / 2) * frame.centerWeight + frame.lift);
      accentOpacity.setValue(frame.accentOpacity);
      accentScale.setValue(frame.accentScale);
      setVisible(frame.visible);
      setActive(frame.visible && frame.centerWeight > 0);
    });
    return () => clock.removeListener(listener);
  }, [
    accentOpacity,
    accentScale,
    centerX,
    centerY,
    clock,
    entry.index,
    entry.tier,
    opacity,
    rotation,
    scale,
    size,
    slot.left,
    slot.top,
    translateX,
    translateY,
  ]);

  return (
    <Animated.View
      testID={`gacha-multi-art-slot-${entry.index}`}
      accessible={false}
      aria-hidden={!visible}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.art,
        slot,
        {
          width: size,
          height: size,
          opacity,
          zIndex: active ? 1 : 0,
          transform: [
            { translateX },
            { translateY },
            { scale },
            {
              rotate: rotation.interpolate({
                inputRange: [-15, 15],
                outputRange: ['-15deg', '15deg'],
              }),
            },
          ],
        },
      ]}>
      <Animated.View
        testID={`gacha-multi-accent-${entry.index}`}
        accessible={false}
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.accent,
          { borderColor: color, opacity: accentOpacity, transform: [{ scale: accentScale }] },
        ]}
      />
      {entry.tier === 'rare' || entry.tier === 'legendary' ? (
        <Animated.View
          accessible={false}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            styles.accent,
            {
              borderColor: color,
              opacity: accentOpacity,
              transform: [
                { scale: Animated.multiply(accentScale, 1.16) },
                { rotateX: '55deg' },
                { rotateZ: '-20deg' },
              ],
            },
          ]}
        />
      ) : null}
      {entry.tier === 'legendary' ? (
        <Animated.View
          accessible={false}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            styles.accent,
            {
              borderColor: GachaSceneColors.glow,
              opacity: accentOpacity,
              transform: [
                { scale: Animated.multiply(accentScale, 1.35) },
                { rotateY: '55deg' },
                { rotateZ: '25deg' },
              ],
            },
          ]}
        />
      ) : null}
      <RewardArtwork entry={entry} size={size} onReady={onReady} forceFallback={forceFallback} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: GachaSceneColors.paper,
  },
  video: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  art: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  accent: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
    borderWidth: Spacing.half,
  },
});
