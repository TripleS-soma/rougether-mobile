import { createTowerEngine, TOWER_RULES, type TowerState } from '@/features/minigame/tower-engine';
import fixtures from '@/features/minigame/tower-fixtures.json';

/** 다음 틱에 상자가 놓일 위치에서 꼭대기까지의 오프셋 — 엔진의 이동·반사와 같은 계산. */
function nextOffset(state: TowerState): number {
  const m = state.moving!;
  const maxX = TOWER_RULES.stageWidth - m.width;
  let x = m.x + m.dir * state.speed;
  if (x < 0) x = -x;
  if (x > maxX) x = 2 * maxX - x;
  return x - state.stack[state.stack.length - 1].x;
}

describe('tower rules version 3 — shared server fixtures', () => {
  it.each(fixtures.fixtures)('matches $name', (fixture) => {
    const engine = createTowerEngine(fixture.seed, fixtures.rulesVersion);
    const drops = new Set(fixture.dropTicks);
    let state = engine.getState();
    for (let tick = 1; tick <= fixture.ticks; tick += 1) {
      expect(state.ended).toBe(false);
      state = engine.step(drops.has(tick));
    }
    expect(state).toMatchObject({
      tick: fixture.ticks,
      score: fixture.score,
      layers: fixture.layers,
      dropTicks: fixture.dropTicks,
      ended: true,
      endReason: fixture.endReason,
    });
    // 끝난 뒤의 입력은 아무것도 바꾸지 않는다.
    expect(engine.step(true)).toEqual(state);
  });

  it('규칙 상수가 픽스처 문서와 같다', () => {
    expect(fixtures.rules).toEqual(TOWER_RULES);
  });
});

describe('tower rules', () => {
  it('같은 시드는 같은 출발 위치·방향을 만든다', () => {
    expect(createTowerEngine(5).getState().moving).toEqual(createTowerEngine(5).getState().moving);
  });

  it('퍼펙트는 잘리지 않고 2점, 아니면 잘린 폭으로 1점', () => {
    const engine = createTowerEngine(42, 3);
    let state = engine.getState();
    while (Math.abs(nextOffset(state)) > TOWER_RULES.perfectTolerance) state = engine.step();
    state = engine.step(true);
    expect(state).toMatchObject({
      score: 2,
      layers: 1,
      streak: 1,
      lastDrop: { perfect: true, cut: null },
    });
    expect(state.stack[1]).toEqual(state.stack[0]);

    for (let i = 0; i < TOWER_RULES.inputCooldown; i += 1) state = engine.step();
    while (Math.abs(nextOffset(state)) < 100) state = engine.step();
    const before = state.stack[state.stack.length - 1];
    state = engine.step(true);
    const placed = state.stack[state.stack.length - 1];
    expect(state).toMatchObject({ score: 3, layers: 2, streak: 0 });
    expect(placed.width).toBeLessThan(before.width);
    expect(placed.width + state.lastDrop!.cut!.width).toBe(before.width);
  });

  it('6틱 쿨다운 안의 누름은 기록되지 않는다', () => {
    const engine = createTowerEngine(99, 3);
    engine.step(true);
    for (let i = 0; i < 5; i += 1) engine.step(true);
    expect(engine.getState().dropTicks).toEqual([1]);
  });

  it('3연속 퍼펙트부터 상자가 다시 넓어진다(시작 폭까지)', () => {
    const engine = createTowerEngine(2026, 3);
    let state = engine.getState();
    // 한 번 크게 잘라 폭을 줄인다.
    while (Math.abs(nextOffset(state)) < 150) state = engine.step();
    state = engine.step(true);
    const narrowed = state.stack[state.stack.length - 1].width;
    expect(narrowed).toBeLessThan(TOWER_RULES.baseWidth);
    const widths: number[] = [];
    while (widths.length < 4) {
      state = engine.step(
        state.tick - (state.dropTicks.at(-1) ?? -6) + 1 >= TOWER_RULES.inputCooldown &&
          Math.abs(nextOffset(state)) <= TOWER_RULES.perfectTolerance,
      );
      if (state.dropTicks.at(-1) === state.tick)
        widths.push(state.stack[state.stack.length - 1].width);
    }
    expect(widths).toEqual([
      narrowed,
      narrowed,
      narrowed + TOWER_RULES.growStep,
      narrowed + TOWER_RULES.growStep * 2,
    ]);
  });

  it('잘못된 시드·규칙 버전은 거부한다', () => {
    expect(() => createTowerEngine(0)).toThrow();
    expect(() => createTowerEngine(1, 2)).toThrow();
  });
});
