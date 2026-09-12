import { createMergeEngine, MergeDirection } from '@/features/minigame/merge-engine';
import fixtures from '@/features/minigame/merge-fixtures.json';

const cycle: MergeDirection[] = [0, 1, 2, 3];
const directionCodes = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 } as const;
const codeFor = (direction: string): MergeDirection =>
  directionCodes[direction as keyof typeof directionCodes];

describe('cat-merge rules version 1', () => {
  it.each([
    { seed: 1, board: [0, 2, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0] },
    { seed: 2, board: [0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0] },
    { seed: 42, board: [0, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0] },
    { seed: 22, board: [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0] },
    { seed: 2147483647, board: [0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0] },
  ])(
    'uses the high unsigned LCG bits for both initial draws with seed $seed',
    ({ seed, board }) => {
      expect(createMergeEngine(seed).getState()).toEqual({
        board,
        directions: [],
        score: 0,
        ended: false,
        endReason: null,
      });
    },
  );

  it.each([
    { seed: 2, direction: 0, board: [0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0] },
    { seed: 9, direction: 1, board: [0, 0, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { seed: 2, direction: 2, board: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0] },
    { seed: 9, direction: 3, board: [4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ])('slides and merges toward direction $direction', ({ seed, direction, board }) => {
    expect(createMergeEngine(seed).move(direction as MergeDirection)).toEqual({
      board,
      directions: [direction],
      score: 4,
      ended: false,
      endReason: null,
    });
  });

  it.each(fixtures)('replays the shared server fixture $name', (fixture) => {
    const engine = createMergeEngine(fixture.seed);
    fixture.actions.forEach(({ direction }, index) => {
      expect(engine.getState().ended).toBe(false);
      expect(engine.move(codeFor(direction)).directions).toHaveLength(index + 1);
    });
    expect(engine.finish()).toEqual({
      board: fixture.board,
      directions: fixture.actions.map(({ direction }) => codeFor(direction)),
      score: fixture.score,
      ended: true,
      endReason:
        fixture.name === 'blocked' ? 'blocked' : fixture.name === 'move-limit' ? 'limit' : 'saved',
    });
  });

  it('merges each tile only once and adds both pair values to the score', () => {
    const engine = createMergeEngine(2);
    for (let i = 0; i < 49; i += 1) engine.move(cycle[i % 4]);
    expect(engine.getState()).toMatchObject({
      board: [2, 2, 2, 2, 64, 8, 4, 0, 8, 16, 0, 0, 2, 0, 0, 0],
      score: 388,
    });
    expect(engine.move(3)).toMatchObject({
      board: [4, 4, 0, 0, 64, 8, 4, 0, 8, 16, 0, 0, 2, 2, 0, 0],
      score: 396,
    });
  });

  it.each([1, 2])('can spawn both 2 and 4 for seed %s', (seed) => {
    const engine = createMergeEngine(seed);
    const spawned = new Set<number>();
    for (let i = 0; i < 100; i += 1) {
      const before = engine.getState();
      const after = engine.move(cycle[i % 4]);
      if (after.directions.length === before.directions.length) continue;
      // Merging preserves tile mass, so its increase is exactly the spawned tile.
      const massBefore = before.board.reduce((sum, value) => sum + value, 0);
      const massAfter = after.board.reduce((sum, value) => sum + value, 0);
      spawned.add(massAfter - massBefore);
    }
    expect(spawned).toEqual(new Set([2, 4]));
  });

  it('does not record no-ops, advance RNG, or award points for them', () => {
    const engine = createMergeEngine(7);
    const initial = engine.getState();
    for (let i = 0; i < 25; i += 1) expect(engine.move(0)).toEqual(initial);
    const untouched = createMergeEngine(7);
    expect(engine.move(1)).toEqual(untouched.move(1));
    expect(engine.move(2)).toEqual(untouched.move(2));
  });

  it('preserves the seed-1 fourth-up no-op after three valid moves', () => {
    const engine = createMergeEngine(1);
    engine.move(0);
    engine.move(0);
    const before = engine.move(0);
    expect(before).toMatchObject({
      board: [8, 2, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      score: 8,
      directions: [0, 0, 0],
    });
    expect(engine.move(0)).toEqual(before);
  });

  it('ends only when no empty cell or adjacent equal pair remains', () => {
    const engine = createMergeEngine(1);
    for (let i = 0; i < 247; i += 1) {
      expect(engine.getState().ended).toBe(false);
      engine.move(cycle[i % 4]);
    }
    const blocked = engine.getState();
    expect(blocked).toMatchObject({
      board: [2, 128, 4, 2, 4, 64, 8, 256, 2, 8, 16, 2, 32, 2, 8, 4],
      score: 3028,
      ended: true,
      endReason: 'blocked',
    });
    expect(blocked.directions).toHaveLength(247);
    for (const direction of cycle) expect(engine.move(direction)).toEqual(blocked);
    expect(engine.finish()).toEqual(blocked);
  });

  it('continues beyond 2048 and ends at exactly 2000 valid moves', () => {
    const engine = createMergeEngine(1);
    const fixture = fixtures.find(({ name }) => name === 'move-limit')!;
    expect(fixture.actions).toHaveLength(2000);
    fixture.actions.forEach(({ direction }, index) => {
      const before = engine.getState();
      expect(before.ended).toBe(false);
      expect(before.directions).toHaveLength(index);
      const state = engine.move(codeFor(direction));
      if (index === 1058) {
        expect(state.board).toContain(2048);
        expect(state.ended).toBe(false);
      }
      if (index === 1986) {
        expect(state.board).toContain(4096);
        expect(state.ended).toBe(false);
      }
    });
    const limited = engine.getState();
    expect(limited).toMatchObject({
      board: [0, 4, 128, 4096, 0, 0, 2, 128, 2, 0, 0, 4, 0, 0, 0, 8],
      score: 45880,
      ended: true,
      endReason: 'limit',
    });
    expect(engine.move(0)).toEqual(limited);
    expect(engine.finish()).toEqual(limited);
  });

  it('keeps manual finish idempotent and stops all subsequent moves', () => {
    const engine = createMergeEngine(2);
    engine.move(0);
    const before = engine.getState();
    const finished = engine.finish();
    expect(finished).toEqual({ ...before, ended: true, endReason: 'saved' });
    expect(engine.finish()).toEqual(finished);
    for (const direction of cycle) expect(engine.move(direction)).toEqual(finished);
    expect(createMergeEngine(1).finish()).toMatchObject({
      score: 0,
      directions: [],
      ended: true,
      endReason: 'saved',
    });
  });

  it('returns independent board and transcript snapshots from every operation', () => {
    const engine = createMergeEngine(2);
    const initial = engine.getState();
    initial.board.fill(16384);
    initial.directions.push(2);
    const moved = engine.move(0);
    expect(moved).toMatchObject({ score: 4, directions: [0] });
    moved.board.fill(0);
    moved.directions.push(3);
    const finished = engine.finish();
    expect(finished).toMatchObject({ score: 4, directions: [0] });
    expect(finished.board[1]).toBe(4);
    finished.board.fill(0);
    finished.directions.length = 0;
    expect(engine.getState()).toMatchObject({ score: 4, directions: [0] });
    expect(engine.getState().board[1]).toBe(4);
  });

  it.each([0, -1, 2147483648, 1.5, NaN, Infinity])('rejects invalid seed %s', (seed) => {
    expect(() => createMergeEngine(seed)).toThrow('Invalid merge seed');
  });

  it.each([-1, 4, 1.5, NaN, Infinity])(
    'rejects invalid direction %s without changing state',
    (input) => {
      const engine = createMergeEngine(1);
      const initial = engine.getState();
      expect(() => engine.move(input as MergeDirection)).toThrow('Invalid merge direction');
      expect(engine.getState()).toEqual(initial);
      engine.finish();
      expect(() => engine.move(input as MergeDirection)).toThrow('Invalid merge direction');
    },
  );
});
