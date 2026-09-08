import type { RevealPlanItem, RevealTier } from '@/components/screens/gacha/reveal-motion';
import timing from '@/constants/gacha-multi-timing.json';
import { clamp01, lerp } from '@/utils/math';
import { GachaStage, Spacing } from '@/constants/theme';

/** The six onsets are authored into gacha-reveal-multi.mp4, not JS timers. */
export const MULTI_REVEAL_TIMING = {
  ...timing,
  artworkTimeoutMs: 1800,
  playbackGraceMs: 3000,
} as const;

export const getMultiRevealBeatMs = (index: number) =>
  MULTI_REVEAL_TIMING.leadInMs + index * MULTI_REVEAL_TIMING.beatMs;

export const getMultiRevealDuration = (count: number) =>
  count > 0 ? getMultiRevealBeatMs(count - 1) + MULTI_REVEAL_TIMING.finalHoldMs : 0;

const ENTRANCES: Record<RevealTier, { peak: number; turn: number; accent: number }> = {
  ungraded: { peak: 1.65, turn: 0, accent: 0.2 },
  common: { peak: 1.65, turn: -2, accent: 0.25 },
  rare: { peak: 1.85, turn: -7, accent: 0.65 },
  legendary: { peak: 2.05, turn: -13, accent: 1 },
};

/** A large center entrance docks into the item's slot before the next chime. */
export function getMultiRevealArtFrame(tier: RevealTier, index: number, currentMs: number) {
  const elapsed = Math.max(0, currentMs - getMultiRevealBeatMs(index));
  const visible = currentMs >= getMultiRevealBeatMs(index);
  const entrance = 1 - Math.pow(1 - clamp01(elapsed / 170), 3);
  const dock = 1 - Math.pow(1 - clamp01((elapsed - 150) / 340), 3);
  const motion = ENTRANCES[tier];
  return {
    visible,
    opacity: visible ? clamp01(elapsed / 70) : 0,
    scale: lerp(lerp(0.45, motion.peak, entrance), 1, dock),
    centerWeight: 1 - dock,
    lift: lerp(Spacing.five, -Spacing.two, entrance) * (1 - dock),
    rotation: lerp(lerp(motion.turn, -motion.turn / 4, entrance), 0, dock),
    accentOpacity: visible
      ? motion.accent * clamp01(elapsed / 70) * (1 - clamp01((elapsed - 180) / 700))
      : 0,
    accentScale: lerp(0.65, 1.35, clamp01(elapsed / 820)),
  };
}

/** Fit the complete alpha-art arrangement in the phone's safe central stage. */
export function getMultiRevealLayout(width: number, height: number, count: number) {
  const columns = Math.min(3, Math.max(1, count));
  const rows = Math.max(1, Math.ceil(count / columns));
  const gap = Spacing.three;
  const availableWidth = Math.max(1, Math.min(GachaStage.storybook, width - Spacing.four * 2));
  const size = Math.max(
    1,
    Math.min(
      GachaStage.box,
      (availableWidth - gap * (columns - 1)) / columns,
      (height * 0.46 - gap * (rows - 1)) / rows,
    ),
  );
  const gridWidth = size * columns + gap * (columns - 1);
  const gridHeight = size * rows + gap * (rows - 1);
  const centerX = width / 2;
  const centerY = height * 0.45;
  return {
    size,
    centerX,
    centerY,
    slots: Array.from({ length: count }, (_, index) => ({
      left: centerX - gridWidth / 2 + (index % columns) * (size + gap),
      top: centerY - gridHeight / 2 + Math.floor(index / columns) * (size + gap),
    })),
  };
}

export type MultiRevealCue = { index: number; strength: 'light' | 'medium' | 'heavy' };

/** Do not replay stale beats after a seek/stall, or replay a cue on a rewind. */
export function createMultiRevealCueTracker(items: readonly RevealPlanItem[]) {
  let highWatermark = -1;
  return (currentMs: number): readonly MultiRevealCue[] => {
    if (!Number.isFinite(currentMs) || currentMs <= highWatermark) return [];
    const crossed = items.flatMap((entry, index): MultiRevealCue[] => {
      const atMs = getMultiRevealBeatMs(index);
      if (atMs <= highWatermark || atMs > currentMs || currentMs - atMs > 180) return [];
      return [
        {
          index,
          strength:
            entry.tier === 'legendary' ? 'heavy' : entry.tier === 'rare' ? 'medium' : 'light',
        },
      ];
    });
    highWatermark = currentMs;
    return crossed.slice(-1);
  };
}
