import type { RevealTier } from '@/components/screens/gacha/reveal-motion';
import { clamp01, lerp } from '@/utils/math';

export type CinematicHapticCue = { atMs: number; strength: 'light' | 'medium' | 'heavy' };
export type CinematicTheme = 'default' | 'christmas';

export type CinematicMotion = {
  durationMs: number;
  revealAtMs: number;
  entranceMs: number;
  initialScale: number;
  overshootScale: number;
  initialRotation: number;
  haptics: readonly CinematicHapticCue[];
};

const COMMON: CinematicMotion = {
  durationMs: 2400,
  revealAtMs: 1100,
  entranceMs: 220,
  initialScale: 0.84,
  overshootScale: 1.025,
  initialRotation: 0,
  haptics: [{ atMs: 1100, strength: 'light' }],
};

const MOTION: Record<RevealTier, CinematicMotion> = {
  ungraded: COMMON,
  common: COMMON,
  rare: {
    durationMs: 2700,
    revealAtMs: 1300,
    entranceMs: 280,
    initialScale: 0.75,
    overshootScale: 1.045,
    initialRotation: -2,
    haptics: [
      { atMs: 680, strength: 'light' },
      { atMs: 1300, strength: 'medium' },
    ],
  },
  legendary: {
    durationMs: 2900,
    revealAtMs: 1550,
    entranceMs: 300,
    initialScale: 0.62,
    overshootScale: 1.07,
    initialRotation: -5,
    haptics: [
      { atMs: 720, strength: 'light' },
      { atMs: 1550, strength: 'heavy' },
      { atMs: 1780, strength: 'medium' },
    ],
  },
};

export function getCinematicMotion(
  tier: RevealTier,
  theme: CinematicTheme = 'default',
): CinematicMotion {
  if (theme !== 'christmas') return MOTION[tier];
  return {
    durationMs: 3400,
    revealAtMs: 1550,
    entranceMs: 570,
    initialScale: 0.32,
    overshootScale: 1,
    initialRotation: 0,
    haptics: [
      {
        atMs: 1550,
        strength: tier === 'legendary' ? 'heavy' : tier === 'rare' ? 'medium' : 'light',
      },
    ],
  };
}

const expoOut = (progress: number) => (progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress));

/** Sample the furniture from media time, so buffering freezes every visual together. */
export function getCinematicArtFrame(
  tier: RevealTier,
  currentMs: number,
  theme: CinematicTheme = 'default',
) {
  const motion = getCinematicMotion(tier, theme);
  const elapsed = Math.max(0, currentMs - motion.revealAtMs);
  if (theme === 'christmas') {
    const progress = clamp01(elapsed / motion.entranceMs);
    // Match the approved gift-to-reward rise: back.out(1.25), from a 720px stage.
    const c = 1.25;
    const eased =
      progress === 1 ? 1 : 1 + (c + 1) * Math.pow(progress - 1, 3) + c * Math.pow(progress - 1, 2);
    return {
      opacity: currentMs < motion.revealAtMs ? 0 : clamp01(elapsed / 180),
      translateY: lerp(475 * 1.5, 0, eased),
      scale: lerp(motion.initialScale, 1, eased),
      rotation: 0,
    };
  }
  const entrance = expoOut(clamp01(elapsed / motion.entranceMs));
  const settle = 1 - Math.pow(1 - clamp01((elapsed - motion.entranceMs) / 320), 3);
  const peakRotation = tier === 'legendary' ? 1 : 0;
  return {
    opacity: currentMs < motion.revealAtMs ? 0 : clamp01(elapsed / 110),
    translateY: lerp(lerp(72, -8, entrance), 0, settle),
    scale: lerp(lerp(motion.initialScale, motion.overshootScale, entrance), 1, settle),
    rotation: lerp(lerp(motion.initialRotation, peakRotation, entrance), 0, settle),
  };
}

/** The PNG slot follows the exact cover crop of the 1080 × 2340 movie/poster. */
export function getCinematicStageLayout(
  width: number,
  height: number,
  theme: CinematicTheme = 'default',
) {
  const scale = Math.max(width / 1080, height / 2340);
  if (theme === 'christmas') {
    return {
      scale,
      left: width / 2 - (585 * scale) / 2,
      top: height / 2 + (952.5 - 1170) * scale - (585 * scale) / 2,
      width: 585 * scale,
      height: 585 * scale,
    };
  }
  return {
    scale,
    left: width / 2 - (439 * scale) / 2,
    top: height / 2 + (780 - 1170) * scale - (430 * scale) / 2,
    width: 439 * scale,
    height: 430 * scale,
  };
}

/** Consume each cue once, including on rewinds; do not replay stale cues after a stall. */
export function createCinematicCueTracker(tier: RevealTier, theme: CinematicTheme = 'default') {
  let highWatermark = -1;
  const cues = getCinematicMotion(tier, theme).haptics;
  return (currentMs: number): readonly CinematicHapticCue[] => {
    if (!Number.isFinite(currentMs) || currentMs <= highWatermark) return [];
    const crossed = cues.filter(
      (cue) => cue.atMs > highWatermark && cue.atMs <= currentMs && currentMs - cue.atMs <= 180,
    );
    highWatermark = currentMs;
    return crossed.slice(-1);
  };
}
