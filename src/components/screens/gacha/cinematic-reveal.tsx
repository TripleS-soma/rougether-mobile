import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AppState, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  createCinematicCueTracker,
  getCinematicArtFrame,
  getCinematicMotion,
  getCinematicStageLayout,
  type CinematicHapticCue,
} from '@/components/screens/gacha/cinematic-timeline';
import { RewardArtwork } from '@/components/screens/gacha/reward-artwork';
import type {
  RevealMotionProfile,
  RevealPlanItem,
  RevealTier,
} from '@/components/screens/gacha/reveal-motion';
import { Overlay } from '@/constants/theme';
import { useAnimatedValue, useLatestRef } from '@/hooks/use-stable-value';
import { hapticImpact } from '@/utils/haptics';

import commonPoster from '@/assets/images/gacha/cinematic-common.jpg';
import legendaryPoster from '@/assets/images/gacha/cinematic-legendary.jpg';
import rarePoster from '@/assets/images/gacha/cinematic-rare.jpg';
import commonVideo from '@/assets/videos/gacha-reveal-common.mp4';
import legendaryVideo from '@/assets/videos/gacha-reveal-legendary.mp4';
import rareVideo from '@/assets/videos/gacha-reveal-rare.mp4';

const VIDEOS: Record<RevealTier, number> = {
  ungraded: commonVideo,
  common: commonVideo,
  rare: rareVideo,
  legendary: legendaryVideo,
};
const POSTERS: Record<RevealTier, number> = {
  ungraded: commonPoster,
  common: commonPoster,
  rare: rarePoster,
  legendary: legendaryPoster,
};

export const getRevealVideoSource = (tier: RevealTier) => VIDEOS[tier];
export const getRevealPosterSource = (tier: RevealTier) => POSTERS[tier];

export type CinematicCompletionReason =
  'finished' | 'error' | 'timeout' | 'background' | 'reduced-motion';

export type CinematicRevealShellProps = {
  entry?: RevealPlanItem;
  profile: RevealMotionProfile;
  soundEffectsEnabled?: boolean;
  reducedMotion?: boolean;
  onComplete?: (reason: CinematicCompletionReason) => void;
};

function useStageLayout() {
  const viewport = useWindowDimensions();
  const [size, setSize] = useState({ width: viewport.width, height: viewport.height });
  return {
    slot: getCinematicStageLayout(size.width, size.height),
    onLayout: ({ nativeEvent }: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = nativeEvent.layout;
      if (width > 0 && height > 0 && (width !== size.width || height !== size.height)) {
        setSize({ width, height });
      }
    },
  };
}

/** Static result hold uses the same poster crop and alpha slot as the last video frame. */
export function CinematicRewardStage({
  entry,
  tier,
  showArtwork = true,
  children,
}: {
  entry?: RevealPlanItem;
  tier: RevealTier;
  showArtwork?: boolean;
  children?: ReactNode;
}) {
  const { slot, onLayout } = useStageLayout();
  const { scale: _stageScale, ...artLayout } = slot;
  return (
    <View
      style={styles.stage}
      onLayout={onLayout}
      pointerEvents="none"
      testID="gacha-cinematic-stage">
      <Image source={POSTERS[tier]} style={styles.fill} contentFit="cover" transition={0} />
      {showArtwork && entry ? (
        <View style={[styles.art, artLayout]} testID="gacha-cinematic-art-slot">
          <RewardArtwork entry={entry} width={slot.width} height={slot.height} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

function ReducedCinematic({ entry, profile, onComplete }: CinematicRevealShellProps) {
  const complete = useLatestRef(onComplete);
  const completed = useRef(false);
  useEffect(() => {
    if (completed.current) return;
    completed.current = true;
    complete.current?.('reduced-motion');
  }, [complete]);
  return <CinematicRewardStage entry={entry} tier={profile.tier} />;
}

/** No player is even created when reduced motion is enabled. */
export function CinematicRevealShell(props: CinematicRevealShellProps) {
  return props.reducedMotion ? (
    <ReducedCinematic {...props} />
  ) : (
    <PlayingCinematic key={props.profile.tier} {...props} />
  );
}

const HAPTIC_STYLES: Record<CinematicHapticCue['strength'], Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};
const ART_READY_TIMEOUT_MS = 1800;
const PLAYBACK_GRACE_MS = 3000;

function PlayingCinematic({
  entry,
  profile,
  soundEffectsEnabled = true,
  onComplete,
}: CinematicRevealShellProps) {
  const tier = profile.tier;
  const { slot, onLayout } = useStageLayout();
  const { scale: stageScale, ...artLayout } = slot;
  const opacity = useAnimatedValue(0);
  const translateY = useAnimatedValue(72);
  const scale = useAnimatedValue(getCinematicMotion(tier).initialScale);
  const rotation = useAnimatedValue(getCinematicMotion(tier).initialRotation);
  const [artReady, setArtReady] = useState(entry?.renderKind !== 'asset');
  const [artTimedOut, setArtTimedOut] = useState(false);
  const ready = useLatestRef(artReady);
  const [finished, setFinished] = useState(false);
  const completed = useRef(false);
  const started = useRef(false);
  const complete = useLatestRef(onComplete);
  const sound = useLatestRef(soundEffectsEnabled);
  // useVideoPlayer loads and releases the local source. Replacing it again doubles decode work.
  const player = useVideoPlayer(VIDEOS[tier], (instance) => {
    instance.loop = false;
    instance.muted = !soundEffectsEnabled;
    instance.volume = soundEffectsEnabled ? 0.86 : 0;
    instance.timeUpdateEventInterval = 1 / 30;
    instance.staysActiveInBackground = false;
    instance.audioMixingMode = 'mixWithOthers';
  });

  // Native useVideoPlayer releases its SharedObject in a passive cleanup registered above.
  // Remove native subscriptions and stop audio in layout cleanup, before that release.
  useLayoutEffect(() => {
    let disposed = false;
    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    let artTimer: ReturnType<typeof setTimeout> | undefined;
    const cues = createCinematicCueTracker(tier);
    const setFrame = (currentMs: number) => {
      const frame = getCinematicArtFrame(tier, currentMs);
      opacity.setValue(frame.opacity);
      translateY.setValue(frame.translateY);
      scale.setValue(frame.scale);
      rotation.setValue(frame.rotation);
    };
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
      setFrame(getCinematicMotion(tier).durationMs);
      setFinished(true);
      complete.current?.(reason);
    };
    const subscriptions = [
      player.addListener('timeUpdate', ({ currentTime }) => {
        if (disposed || completed.current || !started.current || !Number.isFinite(currentTime))
          return;
        const currentMs = Math.max(0, currentTime * 1000);
        setFrame(currentMs);
        for (const cue of cues(currentMs)) hapticImpact(HAPTIC_STYLES[cue.strength]);
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
      ART_READY_TIMEOUT_MS + getCinematicMotion(tier).durationMs + PLAYBACK_GRACE_MS,
    );
    artTimer = setTimeout(() => {
      if (disposed || completed.current || ready.current) return;
      setArtTimedOut(true);
      setArtReady(true);
    }, ART_READY_TIMEOUT_MS);

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
  }, [complete, opacity, player, ready, rotation, scale, tier, translateY]);

  useEffect(() => {
    if (!artReady || started.current || completed.current) return;
    started.current = true;
    player.play();
  }, [artReady, player]);

  // The short musical sting is mixed with the opening SFX, so it follows the effects toggle.
  // Room background music has its own setting and does not control one-shot reveal sounds.
  useEffect(() => {
    if (completed.current) return;
    player.muted = !sound.current;
    player.volume = sound.current ? 0.86 : 0;
  }, [player, sound, soundEffectsEnabled]);

  return (
    <View
      style={styles.stage}
      onLayout={onLayout}
      pointerEvents="none"
      testID="gacha-cinematic-reveal">
      <Image source={POSTERS[tier]} style={styles.fill} contentFit="cover" transition={0} />
      {!finished ? (
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="cover"
          playsInline
          surfaceType="textureView"
          style={styles.video}
          testID={`gacha-reveal-video-${tier}`}
        />
      ) : null}
      {entry ? (
        <Animated.View
          style={[
            styles.art,
            artLayout,
            {
              opacity,
              transform: [
                { translateY: Animated.multiply(translateY, stageScale) },
                { scale },
                {
                  rotate: rotation.interpolate({
                    inputRange: [-10, 10],
                    outputRange: ['-10deg', '10deg'],
                  }),
                },
              ],
            },
          ]}
          testID="gacha-cinematic-art-slot">
          <RewardArtwork
            entry={entry}
            width={slot.width}
            height={slot.height}
            onReady={() => setArtReady(true)}
            forceFallback={artTimedOut}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  // Expo web renders a bare <video>: inset alone leaves its intrinsic 720 × 1560 size.
  // Explicit bounds make objectFit cover the same stage as the poster and alpha artwork.
  video: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  stage: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: Overlay.strong },
  art: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
