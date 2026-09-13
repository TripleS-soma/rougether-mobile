/** Version 2 physics is mirrored by the server replay verifier. */
export type RunnerObstacle = { x: number; width: number; height: number };
export type RunnerState = {
  tick: number;
  score: number;
  playerY: number;
  playerVy: number;
  speed: number;
  obstacles: RunnerObstacle[];
  jumpTicks: number[];
  ended: boolean;
  endReason: 'collision' | 'limit' | null;
};
export type RunnerEngine = {
  step: (jump?: boolean) => RunnerState;
  getState: () => RunnerState;
};

/**
 * One bundled source is used by both the Canvas document and replay fixtures.
 * Keep this as source: Hermes does not preserve Function.toString() source.
 * The factory has no clock, rendering, global state, or platform dependencies.
 */
export const RUNNER_ENGINE_SOURCE = String.raw`
function createRunnerEngine(seed, rulesVersion) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647) {
    throw new Error('Invalid runner seed');
  }
  // v3 (#1322): the speed keeps climbing after the v2 plateau and obstacles get one step taller.
  var v3 = (rulesVersion === undefined ? 2 : rulesVersion) >= 3;
  var rng = seed >>> 0;
  var tick = 0;
  var playerY = 0;
  var playerVy = 0;
  var countdown = 60;
  var speed = 8;
  var obstacles = [];
  var jumpTicks = [];
  var ended = false;
  var endReason = null;
  function random() {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return rng;
  }
  function getState() {
    return {
      tick: tick,
      score: Math.floor(tick / 6),
      playerY: playerY,
      playerVy: playerVy,
      speed: speed,
      obstacles: obstacles.map(function (o) {
        return { x: o.x, width: o.width, height: o.height };
      }),
      jumpTicks: jumpTicks.slice(),
      ended: ended,
      endReason: endReason
    };
  }
  function step(jump) {
    if (ended) return getState();
    tick += 1;
    if (jump && playerY === 0) {
      playerVy = 15;
      jumpTicks.push(tick);
    }
    playerY += playerVy;
    playerVy -= 1;
    if (playerY <= 0) {
      playerY = 0;
      playerVy = 0;
    }
    countdown -= 1;
    if (countdown === 0) {
      var width = 28 + (random() % 3) * 16;
      var height = v3
        ? 40 + Math.min(3, Math.floor(tick / 600)) * 8 + (random() % 3) * 16
        : 40 + Math.min(2, Math.floor(tick / 600)) * 6 + (random() % 3) * 16;
      obstacles.push({ x: 720, width: width, height: height });
      countdown = 65 - Math.min(23, Math.floor(tick / 240) * 3) + random() % 31;
    }
    // v2 reaches 16 at tick 2400 and stays there; v3 then adds 1 every 600 ticks (10 s).
    speed = 8 + Math.min(8, Math.floor(tick / 300));
    if (v3) speed += Math.max(0, Math.floor((tick - 2400) / 600));
    for (var i = 0; i < obstacles.length; i += 1) {
      var obstacle = obstacles[i];
      obstacle.x -= speed;
      if (130 > obstacle.x && 100 < obstacle.x + obstacle.width && playerY < obstacle.height) {
        ended = true;
        endReason = 'collision';
      }
    }
    obstacles = obstacles.filter(function (o) { return o.x + o.width >= 0; });
    if (!ended && tick >= 18000) {
      ended = true;
      endReason = 'limit';
    }
    return getState();
  }
  return { step: step, getState: getState };
}`;

/** Evaluate only the fixed bundled source, never any caller-provided code. */
export function createRunnerEngine(seed: number, rulesVersion = 2): RunnerEngine {
  const factory = new Function(`return (${RUNNER_ENGINE_SOURCE})`)() as (
    seed: number,
    rulesVersion: number,
  ) => RunnerEngine;
  return factory(seed, rulesVersion);
}
