import type { RevealTier } from '@/components/screens/gacha/reveal-motion';

export type CinematicHapticCue = { atMs: number; strength: 'light' | 'medium' | 'heavy' };

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

export const getCinematicMotion = (tier: RevealTier): CinematicMotion => MOTION[tier];

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const expoOut = (progress: number) => (progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress));

/** Sample the furniture from media time, so buffering freezes every visual together. */
export function getCinematicArtFrame(tier: RevealTier, currentMs: number) {
  const motion = getCinematicMotion(tier);
  const elapsed = Math.max(0, currentMs - motion.revealAtMs);
  const entrance = expoOut(clamp(elapsed / motion.entranceMs));
  const settle = 1 - Math.pow(1 - clamp((elapsed - motion.entranceMs) / 320), 3);
  const peakRotation = tier === 'legendary' ? 1 : 0;
  return {
    opacity: currentMs < motion.revealAtMs ? 0 : clamp(elapsed / 110),
    translateY: lerp(lerp(72, -8, entrance), 0, settle),
    scale: lerp(lerp(motion.initialScale, motion.overshootScale, entrance), 1, settle),
    rotation: lerp(lerp(motion.initialRotation, peakRotation, entrance), 0, settle),
  };
}

/** The PNG slot follows the exact cover crop of the 1080 × 2340 movie/poster. */
export function getCinematicStageLayout(width: number, height: number) {
  const scale = Math.max(width / 1080, height / 2340);
  return {
    scale,
    left: width / 2 - (439 * scale) / 2,
    top: height / 2 + (780 - 1170) * scale - (430 * scale) / 2,
    width: 439 * scale,
    height: 430 * scale,
  };
}

/** Consume each cue once, including on rewinds; do not replay stale cues after a stall. */
export function createCinematicCueTracker(tier: RevealTier) {
  let highWatermark = -1;
  const cues = getCinematicMotion(tier).haptics;
  return (currentMs: number): readonly CinematicHapticCue[] => {
    if (!Number.isFinite(currentMs) || currentMs <= highWatermark) return [];
    const crossed = cues.filter(
      (cue) => cue.atMs > highWatermark && cue.atMs <= currentMs && currentMs - cue.atMs <= 180,
    );
    highWatermark = currentMs;
    return crossed.slice(-1);
  };
}
