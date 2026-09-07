import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import {
  createMultiRevealCueTracker,
  getMultiRevealArtFrame,
  getMultiRevealBeatMs,
  getMultiRevealDuration,
  getMultiRevealLayout,
  MULTI_REVEAL_TIMING,
} from '@/components/screens/gacha/multi-reveal-timeline';
import { buildRevealPlan } from '@/components/screens/gacha/reveal-motion';

const plan = buildRevealPlan(
  ['일반', '희귀', '일반', '전설', '일반', '희귀'].map((rarity) => ({ rarity })),
);

describe('multi-reveal timeline', () => {
  it('shares the generator contract without running media tools in unit tests', () => {
    const output = spawnSync(
      process.execPath,
      [resolve(__dirname, '../../../../../scripts/generate-gacha-multi-video.mjs'), '--timing'],
      { encoding: 'utf8' },
    );
    expect(output.status).toBe(0);
    expect(JSON.parse(output.stdout)).toEqual({
      revealBeatsMs: Array.from({ length: MULTI_REVEAL_TIMING.maxItems }, (_, index) =>
        getMultiRevealBeatMs(index),
      ),
      durationSeconds: getMultiRevealDuration(MULTI_REVEAL_TIMING.maxItems) / 1000,
      frameCount: 129,
    });
  });

  it('matches the six authored chimes and holds after the final entrance', () => {
    expect(plan.items.map((_, index) => getMultiRevealBeatMs(index))).toEqual([
      600, 1120, 1640, 2160, 2680, 3200,
    ]);
    expect(getMultiRevealDuration(6)).toBe(4300);
    expect(getMultiRevealDuration(2)).toBe(2220);
    expect(getMultiRevealDuration(0)).toBe(0);
  });

  it('reveals each artwork only on its own beat and docks it before the next one', () => {
    for (const entry of plan.items) {
      const at = getMultiRevealBeatMs(entry.index);
      expect(getMultiRevealArtFrame(entry.tier, entry.index, at - 1)).toMatchObject({
        visible: false,
        opacity: 0,
        accentOpacity: 0,
      });
      expect(getMultiRevealArtFrame(entry.tier, entry.index, at + 100).visible).toBe(true);
      expect(getMultiRevealArtFrame(entry.tier, entry.index, at + 510)).toMatchObject({
        visible: true,
        opacity: 1,
        scale: 1,
        centerWeight: 0,
        rotation: 0,
      });
      expect(getMultiRevealArtFrame(entry.tier, entry.index, at + 510).lift).toBeCloseTo(0);
    }
  });

  it('gives rare and legendary objects progressively stronger entrance and accent', () => {
    const common = getMultiRevealArtFrame('common', 0, 770);
    const rare = getMultiRevealArtFrame('rare', 0, 770);
    const legendary = getMultiRevealArtFrame('legendary', 0, 770);
    expect(rare.scale).toBeGreaterThan(common.scale);
    expect(legendary.scale).toBeGreaterThan(rare.scale);
    expect(rare.accentOpacity).toBeGreaterThan(common.accentOpacity);
    expect(legendary.accentOpacity).toBeGreaterThan(rare.accentOpacity);
  });

  it('emits one tier-specific haptic per onset, never on stale clocks or rewinds', () => {
    const cues = createMultiRevealCueTracker(plan.items);
    expect(cues(599)).toEqual([]);
    expect(cues(600)).toEqual([{ index: 0, strength: 'light' }]);
    expect(cues(1125)).toEqual([{ index: 1, strength: 'medium' }]);
    expect(cues(1125)).toEqual([]);
    expect(cues(600)).toEqual([]);
    expect(cues(1126)).toEqual([]);
    expect(cues(2165)).toEqual([{ index: 3, strength: 'heavy' }]);
    expect(cues(NaN)).toEqual([]);
    expect(cues(Infinity)).toEqual([]);
    expect(cues(4000)).toEqual([]);
    expect(cues(3200)).toEqual([]);
  });

  it.each([
    [320, 700],
    [393, 852],
    [320, 568],
  ])('keeps all six slots and the large center entrance inside %s × %s', (width, height) => {
    const layout = getMultiRevealLayout(width, height, 6);
    expect(layout.slots).toHaveLength(6);
    for (const slot of layout.slots) {
      expect(slot.left).toBeGreaterThanOrEqual(24);
      expect(slot.top).toBeGreaterThan(height * 0.2);
      expect(slot.left + layout.size).toBeLessThanOrEqual(width - 24);
      expect(slot.top + layout.size).toBeLessThan(height * 0.7);
    }
    expect(layout.size * 2.05).toBeLessThan(width - 48);
  });

  it('creates only actual slots in original order', () => {
    const layout = getMultiRevealLayout(320, 700, 2);
    expect(layout.slots).toHaveLength(2);
    expect(layout.slots[0].left).toBeLessThan(layout.slots[1].left);
    expect(layout.slots[0].top).toBe(layout.slots[1].top);
    expect(getMultiRevealLayout(320, 700, 0).slots).toEqual([]);
  });
});
