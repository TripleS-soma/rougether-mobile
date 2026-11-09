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

describe('Christmas gift media contract', () => {
  it.each(['common', 'rare', 'legendary'] as const)(
    'keeps %s rewards hidden until the Christmas gift releases',
    (tier) => {
      const theme = 'christmas';
      expect(getCinematicMotion(tier, theme).durationMs).toBe(3400);
      expect(getCinematicArtFrame(tier, 1549, theme).opacity).toBe(0);
      expect(getCinematicArtFrame(tier, 1800, theme).opacity).toBe(1);
      expect(getCinematicArtFrame(tier, 3400, theme)).toEqual({
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
  ])('aligns Christmas artwork with the blank 720×1560 movie at %d×%d', (width, height) => {
    const slot = getCinematicStageLayout(width, height, 'christmas');
    const coverScale = Math.max(width / 720, height / 1560);
    const movieTop = (height - 1560 * coverScale) / 2;
    expect(slot.left).toBeCloseTo(width / 2 - 195 * coverScale);
    expect(slot.top).toBeCloseTo(movieTop + 440 * coverScale);
    expect(slot.width).toBeCloseTo(390 * coverScale);
    expect(slot.height).toBeCloseTo(390 * coverScale);
  });

  it('synchronizes the Christmas haptic to release once, without replaying after a rewind', () => {
    const advance = createCinematicCueTracker('legendary', 'christmas');
    expect(advance(1549)).toEqual([]);
    expect(advance(1555)).toEqual([{ atMs: 1550, strength: 'heavy' }]);
    expect(advance(800)).toEqual([]);
    expect(advance(1559)).toEqual([]);
    expect(advance(1780)).toEqual([]);
  });
});
