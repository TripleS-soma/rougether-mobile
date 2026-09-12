import { createStairsEngine, type StairsDirection } from '@/features/minigame/stairs-engine';
import fixtures from '@/features/minigame/stairs-fixtures.json';

describe('stairs rules version 1', () => {
  it.each(fixtures.fixtures)('matches the shared server fixture: $name', (fixture) => {
    const engine = createStairsEngine(fixture.seed);
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

  it('does not accept a direction on the timeout tick', () => {
    const engine = createStairsEngine(1);
    for (let i = 0; i < 179; i += 1) engine.step();
    expect(engine.step('LEFT')).toMatchObject({
      tick: 180,
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

  it('keeps the path visible and starts gently before reaching the timer floor', () => {
    const engine = createStairsEngine(42);
    expect(engine.getState().timeLimit).toBe(180);
    let state = engine.getState();
    for (let tick = 1; tick <= 900; tick += 1) {
      state = engine.step(tick % 6 === 1 ? state.nextSteps[0].direction : undefined);
      expect(state.column).toBeGreaterThanOrEqual(-3);
      expect(state.column).toBeLessThanOrEqual(3);
      for (const next of state.nextSteps) expect(Math.abs(next.column)).toBeLessThanOrEqual(3);
    }
    expect(state.timeLimit).toBe(45);
    expect(state.score).toBe(150);
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
