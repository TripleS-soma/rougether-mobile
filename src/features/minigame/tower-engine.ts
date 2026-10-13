/**
 * 고양이 탑 쌓기 (cat-tower) — rules are mirrored by the server replay verifier
 * (`TowerReplayVerifier.java`). Integer math only: the Java port must produce the
 * same numbers tick for tick.
 *
 * 한 틱(60 Hz)의 순서: 틱 +1 → 움직이는 상자 이동(벽에서 반사) → 떨어뜨리기 입력 처리
 * (6틱 쿨다운) → 시간 한도 검사. 입력 기록은 떨어뜨린 틱(`dropTicks`)뿐이다.
 */
export type TowerBlock = { x: number; width: number };
export type TowerMoving = TowerBlock & { dir: 1 | -1 };
export type TowerDrop = {
  /** 거의 정확히 겹쳐 잘리지 않았다. */
  perfect: boolean;
  /** 잘려 나간 조각 — 퍼펙트·실패면 null. */
  cut: TowerBlock | null;
};
export type TowerState = {
  tick: number;
  score: number;
  /** 바닥을 뺀 쌓은 층 수. */
  layers: number;
  /** 연속 퍼펙트 수. */
  streak: number;
  speed: number;
  /** 바닥부터 꼭대기까지 쌓인 상자 — 렌더러는 위쪽 일부만 그린다. */
  stack: TowerBlock[];
  moving: TowerMoving | null;
  lastDrop: TowerDrop | null;
  dropTicks: number[];
  ended: boolean;
  endReason: 'miss' | 'limit' | null;
};
export type TowerEngine = {
  step: (drop?: boolean) => TowerState;
  getState: () => TowerState;
};

/** 규칙 상수 — 서버 검증기와 같은 값이어야 한다(픽스처가 교차 검증). */
export const TOWER_RULES = {
  stageWidth: 1000,
  baseWidth: 600,
  perfectTolerance: 8,
  growStep: 20,
  growAfterStreak: 3,
  startSpeed: 6,
  maxSpeed: 18,
  layersPerSpeedUp: 5,
  inputCooldown: 6,
  maxTicks: 18000,
  maxDrops: 3000,
} as const;

/**
 * One bundled source is used by both the Canvas document and replay fixtures.
 * Keep this as source: Hermes does not preserve Function.toString() source.
 */
export const TOWER_ENGINE_SOURCE = String.raw`
function createTowerEngine(seed, rulesVersion) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647) {
    throw new Error('Invalid tower seed');
  }
  if (rulesVersion !== undefined && (!Number.isInteger(rulesVersion) || rulesVersion < 3)) {
    throw new Error('Invalid tower rules version');
  }
  var STAGE = 1000, BASE = 600, PERFECT = 8, GROW = 20, GROW_AFTER = 3;
  var SPEED0 = 6, SPEED_MAX = 18, SPEED_EVERY = 5, COOLDOWN = 6, MAX_TICKS = 18000;
  var rng = seed >>> 0;
  var tick = 0;
  var score = 0;
  var layers = 0;
  var streak = 0;
  var speed = SPEED0;
  var lastDropTick = -COOLDOWN;
  var stack = [{ x: (STAGE - BASE) / 2, width: BASE }];
  var moving = null;
  var lastDrop = null;
  var dropTicks = [];
  var ended = false;
  var endReason = null;
  function random() {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return rng;
  }
  // 새 상자는 꼭대기 폭으로, 시드가 정한 위치·방향에서 출발한다. 늘 벽에서 출발하면 일정한
  // 박자로 누르기만 해도 같은 자리에 떨어져 퍼펙트가 반복됐다(픽스처 생성 때 발견).
  function spawn() {
    var width = stack[stack.length - 1].width;
    var x = (random() >>> 8) % (STAGE - width + 1);
    var dir = ((random() >>> 16) & 1) === 0 ? 1 : -1;
    moving = { x: x, width: width, dir: dir };
  }
  function copy(b) { return { x: b.x, width: b.width }; }
  function getState() {
    return {
      tick: tick, score: score, layers: layers, streak: streak, speed: speed,
      stack: stack.map(copy),
      moving: moving ? { x: moving.x, width: moving.width, dir: moving.dir } : null,
      lastDrop: lastDrop ? { perfect: lastDrop.perfect, cut: lastDrop.cut ? copy(lastDrop.cut) : null } : null,
      dropTicks: dropTicks.slice(),
      ended: ended, endReason: endReason
    };
  }
  function drop() {
    var top = stack[stack.length - 1];
    var offset = moving.x - top.x;
    var placed;
    if (offset <= PERFECT && offset >= -PERFECT) {
      placed = { x: top.x, width: top.width };
      streak += 1;
      score += 2;
      if (streak >= GROW_AFTER && placed.width < BASE) {
        var grown = Math.min(BASE, placed.width + GROW);
        placed.x -= Math.floor((grown - placed.width) / 2);
        placed.width = grown;
        if (placed.x < 0) placed.x = 0;
        if (placed.x > STAGE - grown) placed.x = STAGE - grown;
      }
      lastDrop = { perfect: true, cut: null };
    } else {
      var left = Math.max(moving.x, top.x);
      var right = Math.min(moving.x + moving.width, top.x + top.width);
      if (right - left <= 0) {
        lastDrop = { perfect: false, cut: null };
        moving = null;
        ended = true;
        endReason = 'miss';
        return;
      }
      placed = { x: left, width: right - left };
      var cut = moving.x < left
        ? { x: moving.x, width: left - moving.x }
        : { x: right, width: moving.x + moving.width - right };
      streak = 0;
      score += 1;
      lastDrop = { perfect: false, cut: cut };
    }
    stack.push(placed);
    layers += 1;
    speed = Math.min(SPEED_MAX, SPEED0 + Math.floor(layers / SPEED_EVERY));
    spawn();
  }
  function step(press) {
    if (ended) return getState();
    tick += 1;
    var maxX = STAGE - moving.width;
    moving.x += moving.dir * speed;
    if (moving.x < 0) { moving.x = -moving.x; moving.dir = 1; }
    if (moving.x > maxX) { moving.x = 2 * maxX - moving.x; moving.dir = -1; }
    if (press && tick - lastDropTick >= COOLDOWN) {
      lastDropTick = tick;
      dropTicks.push(tick);
      drop();
    }
    if (!ended && tick >= MAX_TICKS) { ended = true; endReason = 'limit'; }
    return getState();
  }
  spawn();
  return { step: step, getState: getState };
}`;

/** Evaluate only the fixed bundled source, never any caller-provided code. */
export function createTowerEngine(seed: number, rulesVersion?: number): TowerEngine {
  const factory = new Function(`return (${TOWER_ENGINE_SOURCE})`)() as (
    seed: number,
    rulesVersion?: number,
  ) => TowerEngine;
  return factory(seed, rulesVersion);
}
