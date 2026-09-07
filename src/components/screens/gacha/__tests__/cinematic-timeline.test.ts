import {
  createCinematicCueTracker,
  getCinematicArtFrame,
  getCinematicMotion,
  getCinematicStageLayout,
} from '@/components/screens/gacha/cinematic-timeline';
import { getRevealMotionProfile } from '@/components/screens/gacha/reveal-motion';

describe('cinematic media contract', () => {
  it.each(['common', 'rare', 'legendary'] as const)(
    '%s art remains hidden until the movie reveal and settles at the poster geometry',
    (tier) => {
      const { durationMs, revealAtMs } = getCinematicMotion(tier);
      expect(getRevealMotionProfile(tier).cinematicMs).toBe(durationMs);
      expect(getCinematicArtFrame(tier, revealAtMs - 1).opacity).toBe(0);
      expect(getCinematicArtFrame(tier, revealAtMs + 120).opacity).toBe(1);
      expect(getCinematicArtFrame(tier, durationMs)).toEqual({
        opacity: 1,
        translateY: 0,
        scale: 1,
        rotation: 0,
      });
    },
  );

  it.each([
    [390, 844],
    [402, 874],
    [360, 800],
  ])('keeps the transparent art aligned with cover-cropped media at %d × %d', (width, height) => {
    const slot = getCinematicStageLayout(width, height);
    const coverScale = Math.max(width / 1080, height / 2340);
    const movieTop = (height - 2340 * coverScale) / 2;
    expect(slot.left + slot.width / 2).toBeCloseTo(width / 2);
    expect(slot.top + slot.height / 2).toBeCloseTo(movieTop + 780 * coverScale);
    expect(slot.width).toBeCloseTo(439 * coverScale);
    expect(slot.height).toBeCloseTo(430 * coverScale);
    expect(slot.top).toBeGreaterThan(0);
    expect(slot.top + slot.height).toBeLessThan(height);
  });

  it('consumes each legendary haptic once from playback crossings, never again on rewind', () => {
    const advance = createCinematicCueTracker('legendary');
    expect(advance(719)).toEqual([]);
    expect(advance(733)).toEqual([{ atMs: 720, strength: 'light' }]);
    expect(advance(733)).toEqual([]);
    expect(advance(1551)).toEqual([{ atMs: 1550, strength: 'heavy' }]);
    expect(advance(1400)).toEqual([]);
    expect(advance(1555)).toEqual([]);
    expect(advance(1800)).toEqual([{ atMs: 1780, strength: 'medium' }]);
    expect(advance(2900)).toEqual([]);
  });

  it('consumes stale cues silently when playback jumps, and rejects non-finite events', () => {
    const advance = createCinematicCueTracker('legendary');
    expect(advance(Number.NaN)).toEqual([]);
    expect(advance(Number.POSITIVE_INFINITY)).toEqual([]);
    expect(advance(2400)).toEqual([]);
    expect(advance(720)).toEqual([]);
    expect(advance(1550)).toEqual([]);
  });
});
