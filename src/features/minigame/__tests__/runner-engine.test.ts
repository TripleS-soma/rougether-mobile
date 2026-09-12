import { createRunnerEngine, RunnerState } from '@/features/minigame/runner-engine';
import fixtures from '@/features/minigame/runner-v2-fixtures.json';

describe('room-runner rules version 2', () => {
  it.each(fixtures)('replays the server fixture $name', (fixture) => {
    const engine = createRunnerEngine(fixture.seed);
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
    const engine = createRunnerEngine(42);
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
    const engine = createRunnerEngine(1);
    expect(engine.step(true)).toMatchObject({ playerY: 15, playerVy: 14, jumpTicks: [1] });
    for (let tick = 2; tick <= 30; tick += 1) engine.step(true);
    expect(engine.getState()).toMatchObject({ playerY: 15, playerVy: -15, jumpTicks: [1] });
    expect(engine.step(true)).toMatchObject({ playerY: 0, playerVy: 0, jumpTicks: [1] });
    expect(engine.step(true)).toMatchObject({ playerY: 15, jumpTicks: [1, 32] });
  });

  it('keeps the five-minute maximum below the 600-input server limit', () => {
    const engine = createRunnerEngine(1);
    for (let tick = 1; tick <= 59; tick += 1) engine.step(true);
    // The next jump starts 31 ticks after the previous one, including landing.
    expect(engine.getState().jumpTicks).toEqual([1, 32]);
    expect(Math.ceil(18000 / 31)).toBeLessThanOrEqual(600);
  });

  it.each([8, 10, 12])(
    'allows observed obstacle timing with %i frames of lead across varied seeds',
    (lead) => {
      const seeds = [
        1,
        42,
        2147483647,
        ...Array.from({ length: 13 }, (_, i) => (Math.imul(i + 1, 2654435761) >>> 1) + 1),
      ];
      for (const seed of seeds) {
        const engine = createRunnerEngine(seed);
        let state = engine.getState();
        let maxHeight = 0;
        let minSpawnGap = Infinity;
        let previousSpawn = 0;
        while (!state.ended) {
          const obstacle = state.obstacles.find((item) => item.x + item.width > 100);
          const jump = state.playerY === 0 && !!obstacle && obstacle.x <= 130 + state.speed * lead;
          state = engine.step(jump);
          maxHeight = Math.max(maxHeight, ...state.obstacles.map((item) => item.height));
          if (state.obstacles.some((item) => item.x === 720 - state.speed)) {
            if (previousSpawn) minSpawnGap = Math.min(minSpawnGap, state.tick - previousSpawn);
            previousSpawn = state.tick;
          }
          if ([299, 300, 599, 600, 2399, 2400].includes(state.tick)) {
            expect(state.speed).toBe(8 + Math.min(8, Math.floor(state.tick / 300)));
          }
        }
        expect({ seed, ended: state.endReason }).toEqual({ seed, ended: 'limit' });
        expect(state.speed).toBe(16);
        expect(maxHeight).toBe(84);
        expect(minSpawnGap).toBeGreaterThanOrEqual(42);
        expect(minSpawnGap).toBeLessThanOrEqual(45);
        expect(state.jumpTicks.length).toBeGreaterThan(280);
        expect(state.jumpTicks.length).toBeLessThanOrEqual(600);
      }
    },
  );

  it('requires earlier reactions as the obstacles get faster and taller', () => {
    for (const seed of [1, 42, 2147483647, 13579, 24680]) {
      const engine = createRunnerEngine(seed);
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
    const engine = createRunnerEngine(1);
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
    expect(() => createRunnerEngine(seed)).toThrow('Invalid runner seed');
  });
});
