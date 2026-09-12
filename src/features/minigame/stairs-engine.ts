/** Rules version 1 is mirrored by the server replay verifier. */
export type StairsDirection = 'LEFT' | 'RIGHT';
export type StairsInput = { tick: number; direction: StairsDirection };
export type StairsState = {
  tick: number;
  score: number;
  timeLeft: number;
  timeLimit: number;
  column: number;
  nextSteps: { column: number; direction: StairsDirection }[];
  actions: StairsInput[];
  ended: boolean;
  endReason: 'wrong' | 'timeout' | 'limit' | null;
};
export type StairsEngine = {
  step: (direction?: StairsDirection) => StairsState;
  getState: () => StairsState;
};

/** The same fixed source runs in Canvas and deterministic replay tests. */
export const STAIRS_ENGINE_SOURCE = String.raw`
function createStairsEngine(seed) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647) {
    throw new Error('Invalid stairs seed');
  }
  var rng = seed >>> 0;
  var path = [];
  var pathColumn = 0;
  for (var i = 0; i < 1208; i += 1) {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    var direction = ((rng >>> 16) & 1) === 0 ? 'LEFT' : 'RIGHT';
    if (pathColumn <= -3) direction = 'RIGHT';
    if (pathColumn >= 3) direction = 'LEFT';
    pathColumn += direction === 'LEFT' ? -1 : 1;
    path.push({ column: pathColumn, direction: direction });
  }
  var tick = 0;
  var score = 0;
  var timeLeft = 180;
  var timeLimit = 180;
  var lastInput = -5;
  var actions = [];
  var ended = false;
  var endReason = null;
  function getState() {
    return {
      tick: tick, score: score, timeLeft: timeLeft, timeLimit: timeLimit,
      column: score === 0 ? 0 : path[score - 1].column,
      nextSteps: path.slice(score, score + 8).map(function (s) {
        return { column: s.column, direction: s.direction };
      }),
      actions: actions.map(function (input) { return { tick: input.tick, direction: input.direction }; }),
      ended: ended, endReason: endReason
    };
  }
  function step(direction) {
    if (ended) return getState();
    tick += 1;
    timeLeft -= 1;
    if (timeLeft <= 0) {
      ended = true; endReason = 'timeout';
    } else if ((direction === 'LEFT' || direction === 'RIGHT') && tick - lastInput >= 6) {
      lastInput = tick;
      actions.push({ tick: tick, direction: direction });
      if (direction !== path[score].direction) {
        ended = true; endReason = 'wrong';
      } else {
        score += 1;
        timeLimit = Math.max(45, 180 - Math.floor(score / 5) * 6);
        timeLeft = timeLimit;
      }
    }
    if (!ended && tick >= 7200) { ended = true; endReason = 'limit'; }
    return getState();
  }
  return { step: step, getState: getState };
}`;

/** Evaluate only the bundled source, never caller supplied code. */
export function createStairsEngine(seed: number): StairsEngine {
  const factory = new Function(`return (${STAIRS_ENGINE_SOURCE})`)() as (
    seed: number,
  ) => StairsEngine;
  return factory(seed);
}
