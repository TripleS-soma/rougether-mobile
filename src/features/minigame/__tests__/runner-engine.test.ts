import { createRunnerEngine } from '@/features/minigame/runner-engine';
import fixtures from '@/features/minigame/runner-fixtures.json';

describe('room-runner rules version 1', () => {
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
    for (let tick = 1; tick <= 89; tick += 1) engine.step();
    expect(engine.getState().obstacles).toEqual([]);
    expect(engine.step().obstacles).toEqual([{ x: 714, width: 34, height: 38 }]);
    for (let tick = 91; tick <= 168; tick += 1) engine.step();
    expect(engine.getState().obstacles).toEqual([
      { x: 246, width: 34, height: 38 },
      { x: 714, width: 24, height: 28 },
    ]);
  });

  it('records only grounded jumps and lands after 33 ticks', () => {
    const engine = createRunnerEngine(1);
    expect(engine.step(true)).toMatchObject({ playerY: 16, playerVy: 15, jumpTicks: [1] });
    for (let tick = 2; tick <= 32; tick += 1) engine.step(true);
    expect(engine.getState()).toMatchObject({ playerY: 16, playerVy: -16, jumpTicks: [1] });
    expect(engine.step(true)).toMatchObject({ playerY: 0, playerVy: 0, jumpTicks: [1] });
    expect(engine.step(true)).toMatchObject({ playerY: 16, jumpTicks: [1, 34] });
  });

  it('does not allow snapshot mutation to change a replay', () => {
    const engine = createRunnerEngine(1);
    for (let tick = 1; tick <= 90; tick += 1) engine.step();
    const snapshot = engine.getState();
    snapshot.obstacles[0].x = 0;
    snapshot.jumpTicks.push(1);
    expect(engine.getState()).toMatchObject({
      jumpTicks: [],
      obstacles: [{ x: 714, width: 24, height: 28 }],
    });
  });

  it.each([0, -1, 2147483648, 1.5, NaN, Infinity])('rejects invalid seed %s', (seed) => {
    expect(() => createRunnerEngine(seed)).toThrow('Invalid runner seed');
  });
});
