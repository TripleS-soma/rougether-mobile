import { createMergeEngine, MergeDirection } from '@/features/minigame/merge-engine';
import fixtures from '@/features/minigame/merge-v2-fixtures.json';

const cycle: MergeDirection[] = [0, 1, 2, 3];
const directionCodes = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 } as const;
const codeFor = (direction: string): MergeDirection =>
  directionCodes[direction as keyof typeof directionCodes];
const mass = (board: number[]) => board.reduce((sum, value) => sum + value, 0);

function cycleTo(seed: number, moves: number) {
  const engine = createMergeEngine(seed);
  for (let index = 0; engine.getState().directions.length < moves; index += 1) {
    expect(engine.getState().ended).toBe(false);
    engine.move(cycle[index % 4]);
  }
  return engine;
}

describe('cat-merge rules version 2', () => {
  it.each(fixtures)('replays the shared server fixture $name', (fixture) => {
    const engine = createMergeEngine(fixture.seed);
    expect(engine.getState().board.filter(Boolean)).toHaveLength(4);
    fixture.actions.forEach(({ direction }, index) => {
      expect(engine.getState().ended).toBe(false);
      expect(engine.move(codeFor(direction)).directions).toHaveLength(index + 1);
    });
    expect(engine.finish()).toEqual({
      board: fixture.board,
      directions: fixture.actions.map(({ direction }) => codeFor(direction)),
      score: fixture.score,
      movesUntilExtraTile: fixture.movesUntilExtraTile,
      ended: true,
      endReason: fixture.endReason,
    });
  });

  it('adds one extra tile at every eighth valid move and resets its countdown', () => {
    const engine = createMergeEngine(1);
    expect(engine.getState().movesUntilExtraTile).toBe(8);
    for (let index = 0; index < 24; index += 1) {
      const before = engine.getState();
      const after = engine.move(cycle[index % 4]);
      expect(after.directions).toHaveLength(index + 1);
      expect(after.movesUntilExtraTile).toBe(8 - ((index + 1) % 8));
      const added = mass(after.board) - mass(before.board);
      expect((index + 1) % 8 === 0 ? [4, 6, 8] : [2, 4]).toContain(added);
    }
  });

  it('uses a 25 percent four draw across initial tiles instead of the old 10 percent', () => {
    let fours = 0;
    for (let seed = 1; seed <= 1000; seed += 1) {
      const board = createMergeEngine(seed).getState().board;
      expect(board.filter(Boolean)).toHaveLength(4);
      fours += board.filter((value) => value === 4).length;
    }
    expect(fours / 4000).toBeGreaterThan(0.23);
    expect(fours / 4000).toBeLessThan(0.27);
  });

  it('does not consume a turn, RNG, or the extra-tile countdown for a no-op', () => {
    const engine = createMergeEngine(1);
    const before = engine.move(0);
    expect(before.directions).toEqual([0]);
    for (let index = 0; index < 25; index += 1) expect(engine.move(0)).toEqual(before);
    const untouched = createMergeEngine(1);
    untouched.move(0);
    for (const direction of [1, 2, 3, 0, 1, 2, 3] as MergeDirection[]) {
      expect(engine.move(direction)).toEqual(untouched.move(direction));
    }
    expect(engine.getState().movesUntilExtraTile).toBe(8);
  });

  it('keeps two equal pairs separate in the same move and awards only their merged values', () => {
    const engine = cycleTo(1, 17);
    expect(engine.getState().board.slice(0, 4)).toEqual([2, 2, 2, 2]);
    expect(engine.getState().score).toBe(96);
    expect(engine.move(3)).toMatchObject({
      board: [4, 4, 4, 0, 16, 8, 2, 0, 2, 16, 0, 0, 4, 0, 0, 0],
      score: 104,
    });
  });

  it('skips an extra tile on a full board without preventing a remaining merge or advancing RNG', () => {
    const engine = cycleTo(4, 103);
    const before = engine.getState();
    const filled = engine.move(0);
    expect(filled.directions).toHaveLength(104);
    expect(filled.board).not.toContain(0);
    expect(mass(filled.board) - mass(before.board)).toBe(2);
    expect(filled.ended).toBe(false);
    const after = fixtures.find(({ name }) => name === 'after-skipped-extra')!;
    expect(engine.move(codeFor(after.actions[104].direction))).toMatchObject({
      board: after.board,
      score: after.score,
    });
  });

  it('keeps finish idempotent and never accepts another move after a blocked board', () => {
    const engine = cycleTo(1, 146);
    const blocked = engine.getState();
    expect(blocked).toMatchObject({ ended: true, endReason: 'blocked' });
    for (const direction of cycle) expect(engine.move(direction)).toEqual(blocked);
    expect(engine.finish()).toEqual(blocked);
    const saved = createMergeEngine(42);
    const finished = saved.finish();
    expect(finished).toMatchObject({ ended: true, endReason: 'saved', score: 0 });
    expect(saved.finish()).toEqual(finished);
    expect(saved.move(0)).toEqual(finished);
  });

  it.each([0, 3, -1, NaN])('rejects unsupported rules version %s', (rulesVersion) => {
    expect(() => createMergeEngine(1, rulesVersion as 1 | 2)).toThrow(
      'Invalid merge rules version',
    );
  });
});
