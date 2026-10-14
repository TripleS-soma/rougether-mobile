import { createYarnEngine, YARN_RULES, type YarnState } from '@/features/minigame/yarn-engine';
import fixtures from '@/features/minigame/yarn-fixtures.json';

/** 바구니 색은 열린 바구니끼리 겹치지 않는다. */
function expectUniqueBaskets(state: YarnState) {
  expect(new Set(state.baskets.map((b) => b.color)).size).toBe(YARN_RULES.baskets);
  for (const basket of state.baskets) {
    expect(basket.color).toBeGreaterThanOrEqual(0);
    expect(basket.color).toBeLessThan(state.palette);
    expect(basket.count).toBeLessThan(YARN_RULES.basketCapacity);
  }
}

/** 맨 위가 열린 바구니에 맞는 더미를 먼저 집는 봇 — 없으면 0번. */
function greedyPick(state: YarnState): number {
  const fit = state.piles.findIndex((pile) =>
    state.baskets.some((b) => b.color === pile[pile.length - 1]),
  );
  return fit < 0 ? 0 : fit;
}

describe('yarn rules version 3 — shared server fixtures', () => {
  it.each(fixtures.fixtures)('matches $name', (fixture) => {
    const engine = createYarnEngine(fixture.seed, fixtures.rulesVersion);
    let state = engine.getState();
    for (const pile of fixture.picks) {
      expect(state.ended).toBe(false);
      state = engine.pick(pile);
      expectUniqueBaskets(state);
    }
    if (fixture.expected.endReason === 'saved') {
      expect(state.ended).toBe(false);
      state = engine.finish();
    }
    expect(state).toMatchObject({
      score: fixture.expected.score,
      cleared: fixture.expected.cleared,
      endReason: fixture.expected.endReason,
      palette: fixture.expected.palette,
      capacity: fixture.expected.capacity,
      picks: fixture.picks,
      ended: true,
    });
    expect(state.waiting).toHaveLength(fixture.expected.waitingLength);
    // 끝난 뒤의 집기는 아무것도 바꾸지 않는다(기록도 안 된다).
    expect(engine.pick(0)).toEqual(state);
  });

  it('initial_basket_color_bump: 처음 바구니 뽑기가 실제로 겹쳐 +1 mod P로 밀렸다', () => {
    const fixture = fixtures.fixtures.find((f) => f.name === 'initial_basket_color_bump')!;
    // 엔진과 독립된 LCG로 처음 뽑기 순서(더미 6개 → 바구니 3개)를 다시 낸다.
    let rng = fixture.seed >>> 0;
    const draw = (n: number) => {
      rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
      return (rng >>> 16) % n;
    };
    const piles = Array.from({ length: 6 }, () =>
      Array.from({ length: 3 + draw(2) }, () => draw(4)),
    );
    const raw = [draw(4), draw(4), draw(4)];
    const state = createYarnEngine(fixture.seed).getState();
    expect(state.piles).toEqual(piles);
    expect(new Set(raw).size).toBeLessThan(3);
    expect(state.baskets.map((b) => b.color)).not.toEqual(raw);
    expect(state.baskets[0].color).toBe(raw[0]);
  });

  it('auto_fill_chain: 마지막 한 번의 집기로 바구니 3개 이상이 연달아 찬다', () => {
    const fixture = fixtures.fixtures.find((f) => f.name === 'auto_fill_chain')!;
    const engine = createYarnEngine(fixture.seed);
    let before = engine.getState();
    for (const pile of fixture.picks.slice(0, -1)) before = engine.pick(pile);
    const after = engine.pick(fixture.picks[fixture.picks.length - 1]);
    expect(after.cleared - before.cleared).toBeGreaterThanOrEqual(3);
    expect(after.waiting.length).toBeLessThan(before.waiting.length);
  });

  it('규칙 상수가 픽스처 문서와 같다', () => {
    expect(fixtures.rules).toEqual(YARN_RULES);
  });

  it('픽스처가 모든 종료 이유와 가장자리 경우를 덮는다', () => {
    const reasons = new Set(fixtures.fixtures.map((f) => f.expected.endReason));
    expect(reasons).toEqual(new Set(['full', 'saved', 'limit']));
    expect(fixtures.fixtures.some((f) => f.expected.capacity > YARN_RULES.baseCapacity)).toBe(true);
    expect(fixtures.fixtures.some((f) => f.expected.palette === YARN_RULES.maxColors)).toBe(true);
    expect(fixtures.fixtures.find((f) => f.expected.endReason === 'limit')?.picks).toHaveLength(
      YARN_RULES.maxPicks,
    );
  });
});

describe('yarn rules', () => {
  it('같은 시드는 같은 판을 만든다', () => {
    expect(createYarnEngine(5).getState()).toEqual(createYarnEngine(5).getState());
    expect(createYarnEngine(5).getState()).not.toEqual(createYarnEngine(6).getState());
  });

  it('처음 판: 더미 6개(3~4개씩), 바구니 3개, 대기 5칸, 4색', () => {
    const state = createYarnEngine(12345).getState();
    expect(state.piles).toHaveLength(6);
    for (const pile of state.piles) {
      expect([3, 4]).toContain(pile.length);
      for (const color of pile) expect(color).toBeLessThan(4);
    }
    expectUniqueBaskets(state);
    expect(state.baskets.every((b) => b.count === 0)).toBe(true);
    expect(state).toMatchObject({
      palette: 4,
      capacity: 5,
      score: 0,
      cleared: 0,
      waiting: [],
      ended: false,
    });
    expect(state.preview).toBeLessThan(4);
  });

  it('맞는 바구니면 1점, 아니면 대기 칸으로(점수 없음)', () => {
    const engine = createYarnEngine(12345);
    const start = engine.getState();
    const fit = greedyPick(start);
    const color = start.piles[fit][start.piles[fit].length - 1];
    const fitsBasket = start.baskets.some((b) => b.color === color);
    const state = engine.pick(fit);
    if (fitsBasket) {
      expect(state.score).toBe(1);
      expect(state.lastPick?.target).toBeGreaterThanOrEqual(0);
    } else {
      expect(state.score).toBe(0);
      expect(state.waiting).toEqual([color]);
      expect(state.lastPick?.target).toBe(-1);
    }
  });

  it('대기 칸이 꽉 찬 채 안 맞는 공을 집으면 더미는 그대로 두고 끝난다', () => {
    const fixture = fixtures.fixtures.find((f) => f.expected.endReason === 'full')!;
    const engine = createYarnEngine(fixture.seed);
    let before = engine.getState();
    for (const pile of fixture.picks.slice(0, -1)) before = engine.pick(pile);
    const last = fixture.picks[fixture.picks.length - 1];
    const after = engine.pick(last);
    expect(after.endReason).toBe('full');
    expect(after.piles).toEqual(before.piles);
    expect(after.waiting).toEqual(before.waiting);
    expect(after.lastPick).toEqual({
      pile: last,
      color: before.piles[last][before.piles[last].length - 1],
      target: -2,
    });
  });

  it('색 수·대기 칸은 채운 바구니 수를 따라 늘고, 빈 더미는 바로 새로 채워진다', () => {
    const engine = createYarnEngine(424268);
    let state = engine.getState();
    while (!state.ended) {
      state = engine.pick(greedyPick(state));
      expect(state.palette).toBe(Math.min(7, 4 + Math.floor(state.cleared / 8)));
      expect(state.capacity).toBe(Math.min(7, 5 + Math.floor(state.cleared / 15)));
      expect(state.waiting.length).toBeLessThanOrEqual(state.capacity);
      for (const pile of state.piles) expect(pile.length).toBeGreaterThan(0);
      expectUniqueBaskets(state);
      // 완료 보너스 10점 + 공 1점씩: 점수는 채운 바구니와 담은 공으로만 생긴다.
      const inBaskets = state.baskets.reduce((sum, b) => sum + b.count, 0);
      expect(state.score).toBe(state.cleared * 13 + inBaskets);
    }
    expect(state.cleared).toBeGreaterThanOrEqual(15);
  });

  it('스스로 끝내면 saved — 다시 끝내도 그대로다(limit은 픽스처가 덮는다)', () => {
    const saved = createYarnEngine(9);
    saved.pick(0);
    expect(saved.finish()).toMatchObject({ ended: true, endReason: 'saved', picks: [0] });
    expect(saved.finish().endReason).toBe('saved');
  });

  it('잘못된 입력은 거절한다', () => {
    expect(() => createYarnEngine(0)).toThrow('Invalid yarn seed');
    expect(() => createYarnEngine(2147483648)).toThrow('Invalid yarn seed');
    expect(() => createYarnEngine(1.5)).toThrow('Invalid yarn seed');
    expect(() => createYarnEngine(1, 2)).toThrow('Invalid yarn rules version');
    const engine = createYarnEngine(1);
    expect(() => engine.pick(6)).toThrow('Invalid yarn pile');
    expect(() => engine.pick(-1)).toThrow('Invalid yarn pile');
    expect(() => engine.pick(1.5)).toThrow('Invalid yarn pile');
    expect(engine.getState().picks).toEqual([]);
  });
});
