/**
 * 고양이 털실 정리 (cat-yarn) — rules are mirrored by the server replay verifier
 * (`YarnReplayVerifier.java`). Integer math only; the Java port must match exactly.
 * The picture reveal shown by the game document is cosmetic and not part of these rules.
 *
 * Rules v1 (first shipped under rulesVersion 3):
 * - Seed 1..2147483647. LCG: rng = (Math.imul(1664525, rng) + 1013904223) >>> 0.
 *   Every draw is (random() >>> 16) % n (never the low bits).
 * - Colors are 0..6. Palette P = min(7, 4 + floor(cleared / 8)), cleared = baskets completed.
 *   Waiting capacity W = min(7, 5 + floor(cleared / 15)). Both are recomputed whenever
 *   cleared changes (W only grows).
 * - 6 piles (0..5), each an array of colors, top = last element. New pile: length
 *   3 + draw(2), then each ball draw(P), bottom first.
 * - 3 open baskets (0..2) { color, count }, capacity 3. A basket color is unique among the
 *   open baskets: if it equals another open basket's color, color = (color + 1) % P until
 *   unique.
 * - Initial board, in draw order: piles 0..5, then baskets 0..2 (color draw(P), bumped
 *   against the baskets created before it), then preview = draw(P) (no bump at draw time).
 * - pick(i), i = 0..5 (always recorded in picks while the game is running):
 *   1. c = top of pile i. If an open basket has color c (lowest index), pop the ball into it:
 *      score += 1.
 *   2. Otherwise, if waiting.length >= W, the game ends with 'full' and the pile is left
 *      unchanged. Otherwise pop the ball and append it to waiting (no points).
 *   3. A basket reaching count 3 completes: score += 10, cleared += 1 (recompute P, W), then it
 *      is replaced in place by { color: preview bumped against the other two open baskets
 *      (with the new P), count 0 } and a new preview = draw(P) is drawn.
 *   4. After any completion in step 1, auto-fill: scan waiting from index 0, move the first
 *      ball whose color matches an open basket (lowest index) into it (score += 1) and remove
 *      it from waiting; if that completes the basket, handle step 3 and rescan from index 0.
 *      Stop when a full pass moves nothing.
 *   5. If pile i is now empty, replace it with a new pile (drawn at this moment).
 *   6. If the game has not ended and picks.length >= 2000, it ends with 'limit'.
 * - finish(): ends a running game with 'saved'. Picks after the end are ignored.
 */
export type YarnBasket = { color: number; count: number };
export type YarnEndReason = 'full' | 'saved' | 'limit';
/** Where the last picked ball went: basket index, -1 = waiting tray, -2 = rejected (full). */
export type YarnLastPick = { pile: number; color: number; target: number };
export type YarnState = {
  piles: number[][];
  baskets: YarnBasket[];
  preview: number;
  waiting: number[];
  /** Waiting tray capacity W. */
  capacity: number;
  /** Palette size P. */
  palette: number;
  score: number;
  cleared: number;
  picks: number[];
  lastPick: YarnLastPick | null;
  ended: boolean;
  endReason: YarnEndReason | null;
};
export type YarnEngine = {
  pick: (pile: number) => YarnState;
  finish: () => YarnState;
  getState: () => YarnState;
};

/** 규칙 상수 — 서버 검증기와 같은 값이어야 한다(픽스처가 교차 검증). */
export const YARN_RULES = {
  piles: 6,
  baskets: 3,
  basketCapacity: 3,
  maxColors: 7,
  basePalette: 4,
  clearedPerColor: 8,
  baseCapacity: 5,
  maxCapacity: 7,
  clearedPerSlot: 15,
  pileBase: 3,
  pileExtra: 2,
  ballScore: 1,
  basketScore: 10,
  maxPicks: 2000,
} as const;

/**
 * One bundled source is used by both the Canvas document and replay fixtures.
 * Keep this as source: Hermes does not preserve Function.toString() source.
 */
export const YARN_ENGINE_SOURCE = String.raw`
function createYarnEngine(seed, rulesVersion) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647) {
    throw new Error('Invalid yarn seed');
  }
  if (rulesVersion !== undefined && (!Number.isInteger(rulesVersion) || rulesVersion < 3)) {
    throw new Error('Invalid yarn rules version');
  }
  var PILES = 6, BASKETS = 3, BASKET_CAP = 3, MAX_PICKS = 2000;
  var rng = seed >>> 0;
  var piles = [];
  var baskets = [];
  var preview = 0;
  var waiting = [];
  var cleared = 0;
  var palette = 4;
  var capacity = 5;
  var score = 0;
  var picks = [];
  var lastPick = null;
  var ended = false;
  var endReason = null;
  function random() {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return rng;
  }
  function draw(n) { return (random() >>> 16) % n; }
  function recompute() {
    palette = Math.min(7, 4 + Math.floor(cleared / 8));
    capacity = Math.min(7, 5 + Math.floor(cleared / 15));
  }
  function newPile() {
    var length = 3 + draw(2);
    var pile = [];
    for (var i = 0; i < length; i += 1) pile.push(draw(palette));
    return pile;
  }
  // Bump the color until no other open basket (excluding slot) uses it.
  function uniqueColor(color, slot) {
    for (;;) {
      var clash = false;
      for (var b = 0; b < baskets.length; b += 1) {
        if (b !== slot && baskets[b].color === color) clash = true;
      }
      if (!clash) return color;
      color = (color + 1) % palette;
    }
  }
  function basketFor(color) {
    for (var b = 0; b < BASKETS; b += 1) {
      if (baskets[b].color === color && baskets[b].count < BASKET_CAP) return b;
    }
    return -1;
  }
  // Returns true when the basket completed (and was replaced).
  function put(b) {
    score += 1;
    baskets[b].count += 1;
    if (baskets[b].count < BASKET_CAP) return false;
    score += 10;
    cleared += 1;
    recompute();
    baskets[b] = { color: uniqueColor(preview, b), count: 0 };
    preview = draw(palette);
    return true;
  }
  function autoFill() {
    var moved = true;
    while (moved) {
      moved = false;
      for (var w = 0; w < waiting.length; w += 1) {
        var b = basketFor(waiting[w]);
        if (b >= 0) {
          waiting.splice(w, 1);
          put(b);
          moved = true;
          break;
        }
      }
    }
  }
  function getState() {
    return {
      piles: piles.map(function (pile) { return pile.slice(); }),
      baskets: baskets.map(function (b) { return { color: b.color, count: b.count }; }),
      preview: preview,
      waiting: waiting.slice(),
      capacity: capacity,
      palette: palette,
      score: score,
      cleared: cleared,
      picks: picks.slice(),
      lastPick: lastPick ? { pile: lastPick.pile, color: lastPick.color, target: lastPick.target } : null,
      ended: ended,
      endReason: endReason
    };
  }
  function pick(i) {
    if (!Number.isInteger(i) || i < 0 || i >= PILES) throw new Error('Invalid yarn pile');
    if (ended) return getState();
    picks.push(i);
    var pile = piles[i];
    var color = pile[pile.length - 1];
    var b = basketFor(color);
    if (b >= 0) {
      pile.pop();
      lastPick = { pile: i, color: color, target: b };
      if (put(b)) autoFill();
    } else if (waiting.length >= capacity) {
      lastPick = { pile: i, color: color, target: -2 };
      ended = true;
      endReason = 'full';
      return getState();
    } else {
      pile.pop();
      waiting.push(color);
      lastPick = { pile: i, color: color, target: -1 };
    }
    if (pile.length === 0) piles[i] = newPile();
    if (picks.length >= MAX_PICKS) { ended = true; endReason = 'limit'; }
    return getState();
  }
  function finish() {
    if (!ended) { ended = true; endReason = 'saved'; }
    return getState();
  }
  for (var p = 0; p < PILES; p += 1) piles.push(newPile());
  for (var s = 0; s < BASKETS; s += 1) {
    baskets.push({ color: -1, count: 0 });
    baskets[s].color = uniqueColor(draw(palette), s);
  }
  preview = draw(palette);
  return { pick: pick, finish: finish, getState: getState };
}`;

/** Evaluate only the fixed bundled source, never any caller-provided code. */
export function createYarnEngine(seed: number, rulesVersion?: number): YarnEngine {
  const factory = new Function(`return (${YARN_ENGINE_SOURCE})`)() as (
    seed: number,
    rulesVersion?: number,
  ) => YarnEngine;
  return factory(seed, rulesVersion);
}
