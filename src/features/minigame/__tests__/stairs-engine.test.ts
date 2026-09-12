import { createStairsEngine, type StairsDirection } from '@/features/minigame/stairs-engine';
import fixtures from '@/features/minigame/stairs-fixtures.json';
import harderFixtures from '@/features/minigame/stairs-v2-fixtures.json';

describe.each([fixtures, harderFixtures])('stairs rules version $rulesVersion', (document) => {
  it.each(document.fixtures)('matches the shared server fixture: $name', (fixture) => {
    const engine = createStairsEngine(fixture.seed, document.rulesVersion as 1 | 2);
    const actions = new Map(fixture.actions.map((action) => [action.tick, action.direction]));
    let state = engine.getState();
    for (let tick = 1; tick <= fixture.ticks; tick += 1) {
      expect(state.ended).toBe(false);
      state = engine.step(actions.get(tick) as StairsDirection | undefined);
    }
    expect(state).toMatchObject({
      tick: fixture.ticks,
      score: fixture.score,
      actions: fixture.actions,
      ended: true,
      endReason: fixture.endReason,
    });
    expect(engine.step('LEFT')).toEqual(state);
  });
});

describe('stairs difficulty and controls', () => {
  it('does not accept a direction on the timeout tick', () => {
    const engine = createStairsEngine(1);
    for (let i = 0; i < 71; i += 1) engine.step();
    expect(engine.step('LEFT')).toMatchObject({
      tick: 72,
      score: 0,
      actions: [],
      endReason: 'timeout',
    });
  });

  it('ignores repeats during the six tick input cooldown without recording them', () => {
    const engine = createStairsEngine(1);
    expect(engine.step('LEFT').score).toBe(1);
    for (let i = 0; i < 5; i += 1) {
      expect(engine.step('RIGHT')).toMatchObject({ score: 1, ended: false });
    }
    expect(engine.step('LEFT')).toMatchObject({
      score: 2,
      actions: [
        { tick: 1, direction: 'LEFT' },
        { tick: 7, direction: 'LEFT' },
      ],
    });
  });

  it('keeps the path readable while reaching the timer floor at 42 steps', () => {
    const engine = createStairsEngine(42);
    expect(engine.getState().timeLimit).toBe(72);
    let state = engine.getState();
    for (let tick = 1; tick <= 252; tick += 1) {
      state = engine.step(tick % 6 === 1 ? state.nextSteps[0].direction : undefined);
      expect(state.column).toBeGreaterThanOrEqual(-3);
      expect(state.column).toBeLessThanOrEqual(3);
      for (const next of state.nextSteps) expect(Math.abs(next.column)).toBeLessThanOrEqual(3);
    }
    expect(state.timeLimit).toBe(18);
    expect(state.score).toBe(42);
  });

  it.each([
    [60, 9],
    [36, 27],
    [24, 36],
  ])('a %i tick rhythm now times out after %i steps while v1 continues', (interval, score) => {
    for (const version of [1, 2] as const) {
      const engine = createStairsEngine(42, version);
      let state = engine.getState();
      for (let tick = 1; tick <= 3600 && !state.ended; tick += 1) {
        state = engine.step(tick % interval === 1 ? state.nextSteps[0].direction : undefined);
      }
      if (version === 1) {
        expect(state.score).toBeGreaterThan(score);
      } else {
        expect(state).toMatchObject({ score, ended: true, endReason: 'timeout' });
      }
    }
  });

  it('still accepts a correct input one tick before the shortest timeout', () => {
    const engine = createStairsEngine(1);
    let state = engine.getState();
    while (state.score < 42) {
      state = engine.step(state.tick % 6 === 0 ? state.nextSteps[0].direction : undefined);
    }
    for (let tick = 0; tick < 16; tick += 1) state = engine.step();
    expect(engine.step(state.nextSteps[0].direction)).toMatchObject({
      score: 43,
      timeLeft: 18,
      ended: false,
    });
  });

  it('returns detached state instead of letting consumers alter the replay', () => {
    const engine = createStairsEngine(1);
    const state = engine.step('LEFT');
    state.actions[0].direction = 'RIGHT';
    state.nextSteps[0].direction = 'RIGHT';
    expect(engine.getState().actions).toEqual([{ tick: 1, direction: 'LEFT' }]);
    expect(engine.getState().nextSteps[0].direction).toBe('LEFT');
  });

  it.each([0, -1, 2147483648, 1.5, Number.NaN])('rejects invalid seed %s', (seed) => {
    expect(() => createStairsEngine(seed)).toThrow('Invalid stairs seed');
  });
});
