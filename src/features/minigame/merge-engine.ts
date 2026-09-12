/** Version 1 rules are mirrored by the server replay verifier. */
export type MergeDirection = 0 | 1 | 2 | 3;
export type MergeState = {
  board: number[];
  directions: MergeDirection[];
  score: number;
  ended: boolean;
  endReason: 'blocked' | 'saved' | 'limit' | null;
};
export type MergeEngine = {
  move: (direction: MergeDirection) => MergeState;
  finish: () => MergeState;
  getState: () => MergeState;
};

/** A fixed, platform-independent source shared by the game document and tests. */
export const MERGE_ENGINE_SOURCE = String.raw`
function createMergeEngine(seed) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647) {
    throw new Error('Invalid merge seed');
  }
  var rng = seed >>> 0;
  var board = Array(16).fill(0);
  var directions = [];
  var score = 0;
  var ended = false;
  var endReason = null;
  function random() {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return rng;
  }
  function spawn() {
    var empty = [];
    for (var i = 0; i < 16; i += 1) {
      if (board[i] === 0) empty.push(i);
    }
    if (empty.length === 0) return;
    // Low LCG bits would tie the tile-value draw to the seed's parity.
    var index = empty[(random() >>> 16) % empty.length];
    board[index] = (random() >>> 16) % 10 === 0 ? 4 : 2;
  }
  function getState() {
    return {
      board: board.slice(),
      directions: directions.slice(),
      score: score,
      ended: ended,
      endReason: endReason
    };
  }
  function isBlocked() {
    for (var i = 0; i < 16; i += 1) {
      if (board[i] === 0) return false;
      if (i % 4 < 3 && board[i] === board[i + 1]) return false;
      if (i < 12 && board[i] === board[i + 4]) return false;
    }
    return true;
  }
  function move(direction) {
    if (!Number.isInteger(direction) || direction < 0 || direction > 3) {
      throw new Error('Invalid merge direction');
    }
    if (ended) return getState();
    var next = board.slice();
    var gained = 0;
    for (var line = 0; line < 4; line += 1) {
      var indices = [];
      for (var offset = 0; offset < 4; offset += 1) {
        if (direction === 0) indices.push(offset * 4 + line);
        if (direction === 1) indices.push(line * 4 + 3 - offset);
        if (direction === 2) indices.push((3 - offset) * 4 + line);
        if (direction === 3) indices.push(line * 4 + offset);
      }
      var values = indices.map(function (index) { return board[index]; })
        .filter(function (value) { return value !== 0; });
      var merged = [];
      for (var j = 0; j < values.length; j += 1) {
        if (j + 1 < values.length && values[j] === values[j + 1]) {
          var value = values[j] * 2;
          merged.push(value);
          gained += value;
          j += 1;
        } else {
          merged.push(values[j]);
        }
      }
      for (var k = 0; k < 4; k += 1) next[indices[k]] = merged[k] || 0;
    }
    if (next.every(function (value, index) { return value === board[index]; })) {
      return getState();
    }
    board = next;
    score += gained;
    directions.push(direction);
    spawn();
    if (isBlocked()) {
      ended = true;
      endReason = 'blocked';
    } else if (directions.length >= 2000) {
      ended = true;
      endReason = 'limit';
    }
    return getState();
  }
  function finish() {
    if (!ended) {
      ended = true;
      endReason = 'saved';
    }
    return getState();
  }
  spawn();
  spawn();
  return { move: move, finish: finish, getState: getState };
}`;

/** Evaluate only the fixed bundled source, never any caller-provided code. */
export function createMergeEngine(seed: number): MergeEngine {
  const factory = new Function(`return (${MERGE_ENGINE_SOURCE})`)() as (
    seed: number,
  ) => MergeEngine;
  return factory(seed);
}
