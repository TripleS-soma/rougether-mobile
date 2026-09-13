import { createRunnerEngine, RunnerState } from '@/features/minigame/runner-engine';
import v2Fixtures from '@/features/minigame/runner-v2-fixtures.json';
import v3Fixtures from '@/features/minigame/runner-v3-fixtures.json';

/** Perfect-play bot: jumps when the next obstacle is `lead` frames away at the current speed. */
function bot(lead: number) {
  return (state: RunnerState) => {
    const obstacle = state.obstacles.find((item) => item.x + item.width > 100);
    return state.playerY === 0 && !!obstacle && obstacle.x <= 130 + state.speed * lead;
  };
}
function play(seed: number, rulesVersion: number, decide: (state: RunnerState) => boolean) {
  const engine = createRunnerEngine(seed, rulesVersion);
  let state = engine.getState();
  let maxHeight = 0;
  let minSpawnGap = Infinity;
  let previousSpawn = 0;
  const speeds = new Map<number, number>();
  while (!state.ended) {
    state = engine.step(decide(state));
    speeds.set(state.tick, state.speed);
    maxHeight = Math.max(maxHeight, ...state.obstacles.map((item) => item.height));
    if (state.obstacles.some((item) => item.x === 720 - state.speed)) {
      if (previousSpawn) minSpawnGap = Math.min(minSpawnGap, state.tick - previousSpawn);
      previousSpawn = state.tick;
    }
  }
  return { state, maxHeight, minSpawnGap, speeds };
}
const SEEDS = [
  1,
  42,
  2147483647,
  ...Array.from({ length: 13 }, (_, i) => (Math.imul(i + 1, 2654435761) >>> 1) + 1),
];

/**
 * Rules shared by every version — the server (`RunnerReplayVerifier.java`) replays the same
 * fixtures, so a physics change means a new version, new fixtures and a server hand-off (#1309).
 */
describe.each([
  { rulesVersion: 2, fixtures: v2Fixtures, maxHeight: 84, terminalSpeed: 16 },
  { rulesVersion: 3, fixtures: v3Fixtures, maxHeight: 96, terminalSpeed: 42 },
])(
  'room-runner rules version $rulesVersion',
  ({ rulesVersion, fixtures, maxHeight, terminalSpeed }) => {
    it.each(fixtures)('replays the server fixture $name', (fixture) => {
      const engine = createRunnerEngine(fixture.seed, rulesVersion);
      const jumpTicks = new Set(fixture.jumpTicks);
      let state = engine.getState();
      for (let tick = 1; tick <= fixture.ticks; tick += 1) {
        expect(state.ended).toBe(false);
        state = engine.step(jumpTicks.has(tick));
      }
      expect(state).toMatchObject({
        tick: fixture.ticks,
        score: fixture.score,
        jumpTicks: fixture.jumpTicks,
        ended: true,
        endReason: fixture.endReason,
      });
      expect(engine.step(true)).toEqual(state);
    });

    it('uses the unsigned LCG and width, height, countdown draw order', () => {
      const engine = createRunnerEngine(42, rulesVersion);
      for (let tick = 1; tick <= 59; tick += 1) engine.step();
      expect(engine.getState().obstacles).toEqual([]);
      expect(engine.step().obstacles).toEqual([{ x: 712, width: 44, height: 56 }]);
      for (let tick = 61; tick <= 153; tick += 1) engine.step(tick === 124);
      expect(engine.getState().obstacles).toEqual([
        { x: -32, width: 44, height: 56 },
        { x: 712, width: 28, height: 40 },
      ]);
    });

    it('records only grounded jumps and lands after 31 ticks', () => {
      const engine = createRunnerEngine(1, rulesVersion);
      expect(engine.step(true)).toMatchObject({ playerY: 15, playerVy: 14, jumpTicks: [1] });
      for (let tick = 2; tick <= 30; tick += 1) engine.step(true);
      expect(engine.getState()).toMatchObject({ playerY: 15, playerVy: -15, jumpTicks: [1] });
      expect(engine.step(true)).toMatchObject({ playerY: 0, playerVy: 0, jumpTicks: [1] });
      expect(engine.step(true)).toMatchObject({ playerY: 15, jumpTicks: [1, 32] });
    });

    it('keeps the five-minute maximum below the 600-input server limit', () => {
      const engine = createRunnerEngine(1, rulesVersion);
      for (let tick = 1; tick <= 59; tick += 1) engine.step(true);
      // The next jump starts 31 ticks after the previous one, including landing.
      expect(engine.getState().jumpTicks).toEqual([1, 32]);
      expect(Math.ceil(18000 / 31)).toBeLessThanOrEqual(600);
    });

    it.each([10, 12])(
      'allows observed obstacle timing with %i frames of lead across varied seeds',
      (lead) => {
        for (const seed of SEEDS) {
          const run = play(seed, rulesVersion, bot(lead));
          expect({ seed, ended: run.state.endReason }).toEqual({ seed, ended: 'limit' });
          expect(run.state.speed).toBe(terminalSpeed);
          expect(run.maxHeight).toBe(maxHeight);
          expect(run.minSpawnGap).toBeGreaterThanOrEqual(42);
          expect(run.minSpawnGap).toBeLessThanOrEqual(45);
          expect(run.state.jumpTicks.length).toBeGreaterThan(280);
          expect(run.state.jumpTicks.length).toBeLessThanOrEqual(600);
        }
      },
    );

    it('requires earlier reactions as the obstacles get faster and taller', () => {
      for (const seed of [1, 42, 2147483647, 13579, 24680]) {
        const engine = createRunnerEngine(seed, rulesVersion);
        let state: RunnerState = engine.getState();
        while (!state.ended) {
          const obstacle = state.obstacles.find((item) => item.x + item.width > 100);
          state = engine.step(state.playerY === 0 && !!obstacle && obstacle.x <= 200);
        }
        expect(state.endReason).toBe('collision');
        expect(state.tick).toBeLessThan(1800);
      }
    });

    it('does not allow snapshot mutation to change a replay', () => {
      const engine = createRunnerEngine(1, rulesVersion);
      for (let tick = 1; tick <= 60; tick += 1) engine.step();
      const snapshot = engine.getState();
      snapshot.obstacles[0].x = 0;
      snapshot.jumpTicks.push(1);
      expect(engine.getState()).toMatchObject({
        jumpTicks: [],
        obstacles: [{ x: 712, width: 28, height: 40 }],
      });
    });

    it.each([0, -1, 2147483648, 1.5, NaN, Infinity])('rejects invalid seed %s', (seed) => {
      expect(() => createRunnerEngine(seed, rulesVersion)).toThrow('Invalid runner seed');
    });
  },
);

describe('room-runner rules version 2 (frozen)', () => {
  it('is the default version and plateaus at speed 16 from tick 2400', () => {
    const run = play(42, 2, bot(8));
    for (const tick of [299, 300, 599, 600, 2399, 2400]) {
      expect(run.speeds.get(tick)).toBe(8 + Math.min(8, Math.floor(tick / 300)));
    }
    expect(run.speeds.get(18000)).toBe(16);
    expect(run.state.endReason).toBe('limit');
    expect(createRunnerEngine(42).getState()).toEqual(createRunnerEngine(42, 2).getState());
  });
});

describe('room-runner rules version 3 (#1322)', () => {
  it('keeps climbing after the v2 plateau: +1 every 600 ticks, 42 at the five-minute limit', () => {
    const run = play(42, 3, bot(10));
    for (const tick of [299, 300, 2399, 2400]) {
      expect(run.speeds.get(tick)).toBe(8 + Math.min(8, Math.floor(tick / 300)));
    }
    expect(run.speeds.get(2999)).toBe(16);
    expect(run.speeds.get(3000)).toBe(17);
    expect(run.speeds.get(6000)).toBe(22);
    expect(run.speeds.get(12000)).toBe(32);
    expect(run.speeds.get(18000)).toBe(42);
  });

  it('raises the tallest obstacle to 96 so the jump window narrows from tick 1800', () => {
    // A lead of 8 frames clears everything in v2 but meets a 96 obstacle at y 92 in v3.
    expect(play(42, 2, bot(8)).state.endReason).toBe('limit');
    const run = play(42, 3, bot(8));
    expect(run.state.endReason).toBe('collision');
    expect(run.state.tick).toBeGreaterThan(1800);
    expect(run.maxHeight).toBe(96);
  });
});
