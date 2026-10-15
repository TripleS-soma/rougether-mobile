import { CURRENT_MINIGAME_RULES_VERSION } from '@/constants/minigames';
import { StaticWhite, YarnBallColors, type SemanticColors } from '@/constants/theme';
import {
  escapeHtml,
  getMinigameCopy,
  MINIGAME_FMT_SOURCE,
  minigameDocumentLanguage,
} from '@/features/minigame/minigame-copy';
import { RUNNER_CAT_IDLE } from '@/features/minigame/runner-character';
import { RunnerPalette } from '@/features/minigame/runner-palette';
import { YARN_ENGINE_SOURCE, YARN_RULES } from '@/features/minigame/yarn-engine';
import { contrastRatio } from '@/utils/color';

export type YarnHtmlOptions = {
  seed: number;
  channelId: string;
  practice?: boolean;
  colors?: SemanticColors;
};

/** 털실 무늬 색 — 털실 색과 대비가 큰 쪽(흰 / 진한 잉크). 색약에서도 무늬로 구분된다. */
export function yarnSymbolColors(): string[] {
  return YarnBallColors.map((bg) =>
    contrastRatio(StaticWhite, bg) >= contrastRatio(RunnerPalette.ink, bg)
      ? StaticWhite
      : RunnerPalette.ink,
  );
}

/**
 * 고양이 털실 정리 문서 (cat-yarn). 시계가 없는 생각하는 게임이라 틱 루프는 애니메이션에만 쓰고,
 * 엔진은 탭(더미 집기)마다 한 번씩 진행한다. 공이 날아가는 연출·방 그림 맞추기는 표시용이며
 * 엔진 상태(서버 검증)와 무관하다. The self-contained document makes no network requests.
 */
export function createYarnHtml(options: YarnHtmlOptions): string {
  if (!Number.isInteger(options.seed) || options.seed < 1 || options.seed > 2147483647) {
    throw new Error('Invalid yarn seed');
  }
  const copy = getMinigameCopy('yarn');
  const h = (key: string) => escapeHtml(copy[key] ?? '');
  const t = options.colors;
  const palette = t
    ? {
        ...RunnerPalette,
        sky: t.screen,
        paper: t.surfaceMuted,
        // 다른 게임은 onTint(다크에서도 진한 잉크)를 쓰지만, 이 게임은 글자가 바탕 위에 바로
        // 올라가므로 화면 본문색을 쓴다 — 다크 테마에서도 읽힌다.
        ink: t.text,
        onPrimary: t.onPrimary,
        muted: t.textMuted,
        primary: t.primary,
        primaryDark: t.primaryText,
        grass: t.grass,
        ground: t.border,
      }
    : { ...RunnerPalette, onPrimary: RunnerPalette.white };
  const config = JSON.stringify({
    seed: options.seed,
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    channelId: options.channelId,
    practice: options.practice === true,
    palette,
    ballColors: YarnBallColors,
    symbolColors: yarnSymbolColors(),
    catImage: RUNNER_CAT_IDLE,
    copy,
  }).replace(/</g, '\\u003c');
  const pileButtons = Array.from(
    { length: YARN_RULES.piles },
    (_, i) =>
      `<button id="pile-${i}" class="pile" style="left:${(((24 + i * 62) / 420) * 100).toFixed(3)}%" hidden></button>`,
  ).join('');
  return `<!doctype html><html lang="${minigameDocumentLanguage()}"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${palette.sky};touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none}
main{width:100%;height:100%;position:relative;overflow:hidden}canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}
button{position:absolute;border:0;background:transparent;color:transparent;cursor:pointer;touch-action:manipulation;min-height:44px;min-width:44px}
button:focus-visible{outline:3px solid ${palette.primaryDark};outline-offset:-2px;border-radius:16px}
#start-btn,#resume-btn{left:26.19%;top:47.33%;width:47.62%;height:9.33%}
#pause-btn{right:4.29%;top:3%;width:12.38%;height:8.67%}
#save-btn{left:14.29%;top:91.33%;width:71.43%;height:7.33%}
.pile{top:50.67%;width:13.81%;height:39.33%}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
[hidden]{display:none!important}
</style></head><body><main aria-label="${h('mainA11y')}">
<canvas id="game" width="840" height="1200" tabindex="0" aria-label="${h('canvasA11y')}">${h('canvasFallback')}</canvas>
<p id="game-status" class="sr-only" role="status" aria-live="polite"></p>
${pileButtons}
<button id="start-btn" aria-label="${h('startA11y')}">${h('startA11y')}</button>
<button id="pause-btn" aria-label="${h('pauseA11y')}" hidden>${h('pauseA11y')}</button>
<button id="resume-btn" aria-label="${h('resume')}" hidden>${h('resume')}</button>
<button id="save-btn" aria-label="${h('saveA11y')}" hidden>${h('saveA11y')}</button>
</main><script>${ENGINE_SCRIPT}\n${MINIGAME_FMT_SOURCE}\n(${YARN_BROWSER_SOURCE})(${config});</script></body></html>`;
}

/**
 * 엔진 소스의 한 줄 주석은 문서에 싣지 않는다 — 영어 문서에 한글이 남지 않게(#893).
 * 주석 줄만 지우므로 실행 코드는 픽스처로 검증한 그대로다.
 */
const ENGINE_SCRIPT = YARN_ENGINE_SOURCE.replace(/^[ \t]*\/\/.*$/gm, '');

const YARN_BROWSER_SOURCE = String.raw`function runYarn(config) {
  'use strict';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  var startButton = document.getElementById('start-btn');
  var pauseButton = document.getElementById('pause-btn');
  var resumeButton = document.getElementById('resume-btn');
  var saveButton = document.getElementById('save-btn');
  var status = document.getElementById('game-status');
  var pileButtons = [0, 1, 2, 3, 4, 5].map(function (i) { return document.getElementById('pile-' + i); });
  var copy = config.copy;
  var colors = config.palette;
  saveButton.setAttribute('aria-label', config.practice ? copy.practiceStopA11y : copy.saveA11y);
  var engine = createYarnEngine(config.seed, config.rulesVersion);
  var state = engine.getState();
  // What is drawn: the engine state, except while a ball is flying (then the pile already lost it).
  var view = state;
  var mode = 'loading';
  var hostActive = true;
  var finished = false;
  var destroyed = false;
  var frameId = 0;
  var lastTime = 0;
  var catImage = new Image();
  var flight = null;   // {color, fx, fy, tx, ty, t}
  var gain = null;     // {value, t}
  var bursts = [];     // basket completion sparkles {x, y, t}
  var tileFlash = null; // {t}
  var shake = 0;
  var FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  var BASKET_X = 24, BASKET_W = 86, BASKET_GAP = 96, BASKET_Y = 106;
  var TRAY_Y = 236, SLOT = 44, SLOT_GAP = 8;
  var PILE_X = 24, PILE_W = 58, PILE_GAP = 62, PILE_TOP = 304, PILE_BOTTOM = 540, BALL = 22;
  var PIC_X = 252, PIC_Y = 14, PIC = 84;
  var REVEAL = [4, 0, 8, 2, 6, 1, 7, 3, 5];
  function post(type, extra) {
    var message = { channelId: config.channelId, type: type };
    if (extra) Object.keys(extra).forEach(function (key) { message[key] = extra[key]; });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else if (window.parent !== window) window.parent.postMessage(message, '*');
  }
  function box(x, y, w, h, r, fill) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function text(value, x, y, size, color, align) {
    ctx.font = '600 ' + size + 'px ' + FONT; ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle'; ctx.fillStyle = color || colors.ink; ctx.fillText(value, x, y);
  }
  function colorName(c) { return copy['color' + c] || String(c + 1); }
  // A different shape per color so the game never relies on hue alone.
  function symbol(c, x, y, r) {
    var s = r * 0.42;
    ctx.fillStyle = config.symbolColors[c]; ctx.strokeStyle = config.symbolColors[c]; ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    if (c === 0) { ctx.arc(x, y, s * 0.55, 0, Math.PI * 2); ctx.fill(); }
    else if (c === 1) { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x - s, y + s * 0.8); ctx.closePath(); ctx.fill(); }
    else if (c === 2) { ctx.rect(x - s * 0.75, y - s * 0.75, s * 1.5, s * 1.5); ctx.fill(); }
    else if (c === 3) { ctx.rect(x - s, y - s * 0.28, s * 2, s * 0.56); ctx.rect(x - s * 0.28, y - s, s * 0.56, s * 2); ctx.fill(); }
    else if (c === 4) { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); }
    else if (c === 5) { ctx.arc(x, y, s * 0.8, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); }
  }
  function ball(c, x, y, r, lifted) {
    if (lifted) { ctx.globalAlpha = 0.2; circle(x, y + r * 0.9, r * 0.9, colors.ink); ctx.globalAlpha = 1; }
    circle(x, y, r + 1.5, colors.ink);
    circle(x, y, r, config.ballColors[c]);
    // Yarn strands.
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = 0.28; ctx.strokeStyle = colors.white; ctx.lineWidth = 1.6;
    for (var k = -2; k <= 2; k += 1) { ctx.beginPath(); ctx.ellipse(x + k * r * 0.34, y, r * 0.9, r * 1.2, 0.5, 0, Math.PI); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
    symbol(c, x, y, r);
  }
  function basketBall(slot, index) {
    return { x: BASKET_X + slot * BASKET_GAP + 18 + index * 25, y: BASKET_Y + 34 };
  }
  function traySlot(index) { return { x: 32 + index * (SLOT + SLOT_GAP) + SLOT / 2, y: TRAY_Y + 30 }; }
  function pileBall(pile, index) {
    return { x: PILE_X + pile * PILE_GAP + PILE_W / 2, y: PILE_BOTTOM - 30 - index * 48 };
  }
  function basket(b, slot) {
    var x = BASKET_X + slot * BASKET_GAP, y = BASKET_Y;
    // Woven basket body with a colored ribbon carrying the color's symbol.
    box(x, y + 26, BASKET_W, 62, 14, colors.pot);
    ctx.globalAlpha = 0.22;
    for (var row = 0; row < 3; row += 1) box(x + 6, y + 40 + row * 14, BASKET_W - 12, 4, 2, colors.potDark);
    ctx.globalAlpha = 1;
    box(x - 3, y + 20, BASKET_W + 6, 12, 6, colors.potDark);
    for (var i = 0; i < 3; i += 1) {
      var p = basketBall(slot, i);
      if (i < b.count) ball(b.color, p.x, p.y - 8, 11);
    }
    box(x + 22, y + 58, BASKET_W - 44, 26, 13, config.ballColors[b.color]);
    symbol(b.color, x + BASKET_W / 2, y + 71, 12);
    for (var d = 0; d < 3; d += 1) {
      circle(x + BASKET_W / 2 - 14 + d * 14, y + 96, 4, d < b.count ? colors.primaryDark : colors.ground);
    }
  }
  function preview(c) {
    var x = 318, y = BASKET_Y + 18;
    box(x, y, 78, 74, 16, colors.paper);
    text(copy.next, x + 39, y + 16, 12, colors.muted, 'center');
    ball(c, x + 39, y + 48, 15);
  }
  function tray() {
    var n = view.waiting.length, cap = view.capacity, danger = mode !== 'ended' && cap - n <= 1;
    var dx = shake > 0 ? Math.sin(shake * 1.7) * shake * 0.6 : 0;
    text(fmt(copy.tray, { n: n, max: cap }), 24, TRAY_Y - 12, 13, danger ? colors.potDark : colors.muted);
    if (danger && n < cap) text(copy.trayDanger, 396, TRAY_Y - 12, 13, colors.potDark, 'right');
    box(24 + dx, TRAY_Y, 372, 60, 18, danger ? colors.blush : colors.paper);
    for (var i = 0; i < 7; i += 1) {
      var p = traySlot(i);
      if (i >= cap) { ctx.globalAlpha = 0.35; box(p.x - SLOT / 2 + dx, p.y - SLOT / 2, SLOT, SLOT, 12, colors.ground); ctx.globalAlpha = 1; continue; }
      box(p.x - SLOT / 2 + dx, p.y - SLOT / 2, SLOT, SLOT, 12, colors.sky);
      if (i < n) ball(view.waiting[i], p.x + dx, p.y, 17);
    }
  }
  function piles() {
    var playing = mode === 'playing';
    for (var i = 0; i < 6; i += 1) {
      var x = PILE_X + i * PILE_GAP;
      box(x, PILE_TOP, PILE_W, PILE_BOTTOM - PILE_TOP, 20, colors.paper);
      var pile = view.piles[i];
      for (var j = 0; j < pile.length; j += 1) {
        var p = pileBall(i, j), top = j === pile.length - 1;
        if (top && playing) circle(p.x, p.y, BALL + 5, colors.sun);
        ball(pile[j], p.x, p.y, top ? BALL : BALL - 3, false);
      }
    }
  }
  // Room pictures revealed tile by tile: drawn with plain shapes in the game palette.
  function picture(k, x, y, s) {
    var u = s / 12;
    if (k === 0) {
      box(x, y, s, s, 0, colors.bearLight);
      box(x + 2 * u, y + 2 * u, 8 * u, 6 * u, u, colors.white);
      circle(x + 7.5 * u, y + 4 * u, 1.3 * u, colors.sun);
      box(x + 2 * u, y + 2 * u, 1.6 * u, 6 * u, u * 0.5, colors.blush); box(x + 8.4 * u, y + 2 * u, 1.6 * u, 6 * u, u * 0.5, colors.blush);
      box(x, y + 9 * u, s, 3 * u, 0, colors.ground);
      box(x + 3 * u, y + 8.2 * u, 6 * u, 1.2 * u, u * 0.5, colors.potDark);
    } else if (k === 1) {
      box(x, y, s, s, 0, colors.paper);
      box(x, y + 9.5 * u, s, 2.5 * u, 0, colors.ground);
      box(x + 1.5 * u, y + 5 * u, 7.5 * u, 4.8 * u, 1.4 * u, colors.primary);
      box(x + 2.3 * u, y + 5.6 * u, 2.6 * u, 2 * u, u, colors.blush); box(x + 5.5 * u, y + 5.6 * u, 2.6 * u, 2 * u, u, colors.bear);
      box(x + 10 * u, y + 3 * u, 0.6 * u, 6.8 * u, 0.3 * u, colors.potDark);
      box(x + 8.8 * u, y + 1.6 * u, 3 * u, 2 * u, u, colors.sun);
    } else if (k === 2) {
      box(x, y, s, s, 0, colors.grassLight);
      box(x, y + 10 * u, s, 2 * u, 0, colors.ground);
      ctx.save(); ctx.translate(x + 6 * u, y + 6 * u);
      for (var leaf = 0; leaf < 5; leaf += 1) { ctx.rotate(Math.PI / 3.2); ctx.beginPath(); ctx.ellipse(0, -2.4 * u, 1.1 * u, 2.6 * u, 0, 0, Math.PI * 2); ctx.fillStyle = leaf % 2 ? colors.grass : colors.primary; ctx.fill(); }
      ctx.restore();
      box(x + 4 * u, y + 7 * u, 4 * u, 3.6 * u, u, colors.pot);
    } else {
      box(x, y, s, s, 0, colors.sky);
      ctx.beginPath(); ctx.ellipse(x + 6 * u, y + 9.6 * u, 5.4 * u, 2 * u, 0, 0, Math.PI * 2); ctx.fillStyle = colors.blush; ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 6 * u, y + 9.6 * u, 3.6 * u, 1.2 * u, 0, 0, Math.PI * 2); ctx.fillStyle = colors.bearLight; ctx.fill();
      if (catImage.complete && catImage.naturalWidth) {
        var w = 6.4 * u, hh = w * catImage.naturalHeight / catImage.naturalWidth;
        ctx.drawImage(catImage, x + 6 * u - w / 2, y + 9.8 * u - hh, w, hh);
      }
      ball(0, x + 10 * u, y + 9 * u, 1.1 * u);
    }
  }
  function pictureProgress(cleared) {
    if (cleared <= 0) return { index: 0, tiles: 0 };
    return { index: Math.floor((cleared - 1) / 9) % 4, tiles: ((cleared - 1) % 9) + 1 };
  }
  function picturePanel() {
    var pr = pictureProgress(view.cleared), tile = PIC / 3;
    box(PIC_X - 4, PIC_Y - 4, PIC + 8, PIC + 8, 14, colors.paper);
    ctx.save(); ctx.beginPath(); ctx.rect(PIC_X, PIC_Y, PIC, PIC); ctx.clip();
    picture(pr.index, PIC_X, PIC_Y, PIC);
    for (var i = pr.tiles; i < 9; i += 1) {
      var cell = REVEAL[i], cx = PIC_X + (cell % 3) * tile, cy = PIC_Y + Math.floor(cell / 3) * tile;
      box(cx + 1, cy + 1, tile - 2, tile - 2, 5, colors.ground);
    }
    if (tileFlash && pr.tiles > 0) {
      var last = REVEAL[pr.tiles - 1];
      ctx.globalAlpha = Math.max(0, 0.8 * (1 - tileFlash.t / 30));
      box(PIC_X + (last % 3) * tile, PIC_Y + Math.floor(last / 3) * tile, tile, tile, 4, colors.white);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function hud() {
    text(config.practice ? copy.titlePractice : copy.title, 24, 26, 16, colors.primaryDark);
    text(fmt(copy.points, { score: view.score }), 24, 60, 28, colors.ink);
    text(fmt(copy.baskets, { n: view.cleared }), 24, 90, 14, colors.muted);
    if (gain) {
      ctx.globalAlpha = Math.max(0, 1 - gain.t / 40);
      text('+' + gain.value, 236, 60 - gain.t * 0.3, 18, colors.primaryDark, 'right');
      ctx.globalAlpha = 1;
    }
    picturePanel();
    if (mode === 'playing') {
      box(350, 18, 52, 52, 18, colors.paper);
      box(368, 33, 5, 21, 2, colors.primaryDark); box(380, 33, 5, 21, 2, colors.primaryDark);
    }
  }
  function sparkles() {
    for (var i = 0; i < bursts.length; i += 1) {
      var b = bursts[i], k = b.t / 24;
      ctx.globalAlpha = Math.max(0, 1 - k);
      for (var j = 0; j < 6; j += 1) {
        var a = j * Math.PI / 3 + 0.3, d = 12 + k * 30;
        circle(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d * 0.7, 3.5 * (1 - k) + 1, colors.sun);
      }
      ctx.globalAlpha = 1;
    }
  }
  function overlay(title, sub) {
    ctx.globalAlpha = 0.96; box(40, 170, 340, 200, 26, colors.paper); ctx.globalAlpha = 1;
    if (catImage.complete && catImage.naturalWidth) {
      var w = 70, hh = w * catImage.naturalHeight / catImage.naturalWidth;
      ctx.drawImage(catImage, 175, 176, w, hh);
    }
    if (title) text(title, 210, 250, 22, colors.ink, 'center');
    if (sub) text(sub, 210, title ? 330 : 256, 15, colors.muted, 'center');
  }
  function pill(label) { box(110, 284, 200, 56, 20, colors.primary); text(label, 210, 312, 20, colors.onPrimary, 'center'); }
  function syncButtons() {
    startButton.hidden = mode !== 'ready' || !hostActive;
    resumeButton.hidden = mode !== 'paused' || !hostActive;
    pauseButton.hidden = mode !== 'playing' || !hostActive;
    saveButton.hidden = (mode !== 'playing' && mode !== 'paused') || !hostActive;
    pileButtons.forEach(function (button, i) {
      button.hidden = mode !== 'playing' || !hostActive;
      var pile = state.piles[i];
      button.setAttribute('aria-label', fmt(copy.pileA11y, { n: i + 1, color: colorName(pile[pile.length - 1]), count: pile.length }));
    });
  }
  function render() {
    if (destroyed) return;
    ctx.fillStyle = colors.sky; ctx.fillRect(0, 0, 420, 600);
    if (mode === 'loading' || mode === 'error') {
      box(24, 220, 372, 80, 24, colors.paper);
      text(mode === 'loading' ? copy.loading : copy.loadFailed, 210, 260, 20, colors.ink, 'center');
      syncButtons(); return;
    }
    hud();
    view.baskets.forEach(basket);
    preview(view.preview);
    tray();
    piles();
    sparkles();
    if (flight) {
      var e = 1 - Math.pow(1 - flight.t, 2);
      var x = flight.fx + (flight.tx - flight.fx) * e;
      var y = flight.fy + (flight.ty - flight.fy) * e - Math.sin(flight.t * Math.PI) * 40;
      ball(flight.color, x, y, BALL - 4 * e, true);
    }
    if (mode === 'playing' || mode === 'paused') {
      box(60, 548, 300, 44, 16, colors.paper);
      text(config.practice ? copy.stopButton : copy.saveButton, 210, 570, 16, colors.primaryDark, 'center');
    }
    if (mode === 'ready') { overlay('', copy.hint); if (hostActive) pill(copy.start); }
    if (mode === 'paused') { overlay(copy.paused, ''); if (hostActive) pill(copy.resume); }
    if (mode === 'ended') {
      var reason = state.endReason === 'full' ? copy.full : state.endReason === 'limit' ? copy.limit : '';
      overlay(copy.gameOver, fmt(copy.baskets, { n: state.cleared }) + (reason ? ' · ' + reason : ''));
      text(fmt(copy.points, { score: state.score }), 210, 292, 36, colors.primaryDark, 'center');
    }
    syncButtons();
  }
  function announce() {
    var list = state.baskets.map(function (b) { return fmt(copy.statusBasket, { color: colorName(b.color), count: b.count }); }).join(', ');
    status.textContent = fmt(copy.statusScore, { score: state.score, cleared: state.cleared }) + ' ' +
      fmt(copy.statusBaskets, { list: list }) + ' ' + fmt(copy.statusTray, { n: state.waiting.length, max: state.capacity }) +
      (mode === 'ended' ? ' ' + copy.statusEnded : mode === 'paused' ? ' ' + copy.statusPaused : '');
  }
  function finish() {
    if (finished || destroyed) return;
    finished = true;
    if (!state.ended) state = engine.finish();
    mode = 'ended'; flight = null; view = state;
    render(); announce();
    post('finish', { result: { ticks: Math.max(1, state.picks.length), picks: state.picks.slice() } });
  }
  function pick(i) {
    if (mode !== 'playing' || !hostActive || destroyed) return;
    var before = state;
    state = engine.pick(i);
    if (state.picks.length === before.picks.length) return;
    var lp = state.lastPick, from = pileBall(i, before.piles[i].length - 1), to;
    if (lp.target >= 0) to = basketBall(lp.target, before.baskets[lp.target].count);
    else if (lp.target === -1) to = traySlot(before.waiting.length);
    else to = null;
    if (to) {
      // Show the pile without the lifted ball while it flies; the engine state is already final.
      var lifted = before.piles.map(function (pile) { return pile.slice(); });
      lifted[i].pop();
      view = { piles: lifted, baskets: before.baskets, preview: before.preview, waiting: before.waiting,
        capacity: before.capacity, score: before.score, cleared: before.cleared };
      flight = { color: lp.color, fx: from.x, fy: from.y, tx: to.x, ty: to.y, t: 0 };
    } else {
      view = state; flight = null; shake = 14;
    }
    var gained = state.score - before.score;
    if (state.cleared > before.cleared) {
      for (var b = 0; b < 3; b += 1) {
        if (state.baskets[b].color !== before.baskets[b].color || state.baskets[b].count < before.baskets[b].count) {
          bursts.push({ x: BASKET_X + b * BASKET_GAP + BASKET_W / 2, y: BASKET_Y + 40, t: 0 });
        }
      }
      tileFlash = { t: 0 };
      post('fx', { kind: state.cleared % 9 === 0 ? 'milestone' : 'merge' });
    } else if (lp.target >= 0) post('fx', { kind: 'step' });
    if (gained > 0) gain = { value: gained, t: 0 };
    if (state.ended) {
      if (state.endReason === 'full') post('fx', { kind: 'over' });
      finish();
      return;
    }
    render(); announce();
  }
  function advance(frames) {
    if (flight) { flight.t = Math.min(1, flight.t + frames / 10); if (flight.t >= 1) { flight = null; view = state; } }
    if (gain) { gain.t += frames; if (gain.t >= 40) gain = null; }
    if (tileFlash) { tileFlash.t += frames; if (tileFlash.t >= 30) tileFlash = null; }
    if (shake > 0) shake = Math.max(0, shake - frames);
    for (var i = bursts.length - 1; i >= 0; i -= 1) { bursts[i].t += frames; if (bursts[i].t >= 24) bursts.splice(i, 1); }
  }
  function animating() { return !!(flight || gain || tileFlash || shake > 0 || bursts.length); }
  function begin() {
    if (mode !== 'ready' || !hostActive || destroyed || document.hidden) return;
    mode = 'playing'; canvas.focus(); render(); announce();
  }
  function pause() {
    if (mode !== 'playing') return;
    flight = null; view = state;
    mode = 'paused'; post('pause', { paused: true }); render(); announce();
  }
  function resume() {
    if (mode !== 'paused' || !hostActive || destroyed || document.hidden) return;
    mode = 'playing'; canvas.focus(); post('pause', { paused: false }); render(); announce();
  }
  function save() { if (hostActive && (mode === 'playing' || mode === 'paused')) finish(); }
  function onKey(event) {
    if ((event.code === 'Space' || event.code === 'Enter') && event.target instanceof Element && event.target.closest('button')) return;
    var digit = /^Digit([1-6])$/.exec(event.code);
    if (digit) { event.preventDefault(); if (!event.repeat) pick(Number(digit[1]) - 1); }
    else if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault(); if (event.repeat) return;
      if (mode === 'ready') begin(); else if (mode === 'paused') resume();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault(); if (event.repeat) return;
      if (mode === 'playing') pause(); else if (mode === 'paused') resume();
    }
  }
  function onVisibility() { if (document.hidden) pause(); }
  function onMessage(event) {
    if (event.source !== window.parent || !event.data || event.data.channelId !== config.channelId) return;
    if (event.data.type === 'active' && typeof event.data.active === 'boolean') window.setYarnActive(event.data.active);
    if (event.data.type === 'destroy') window.destroyYarn();
  }
  function loop(now) {
    if (destroyed) return;
    frameId = requestAnimationFrame(loop);
    if (!animating()) { lastTime = 0; return; }
    if (!lastTime) { lastTime = now; return; }
    var dt = Math.min(100, now - lastTime); lastTime = now;
    advance(dt * 60 / 1000); render();
  }
  window.setYarnActive = function (active) { hostActive = active === true; if (!hostActive) pause(); render(); };
  window.render_game_to_text = function () {
    return JSON.stringify({
      gameCode: 'cat-yarn', rulesVersion: config.rulesVersion, mode: mode,
      coordinates: '420x600; piles 0..5 left to right, top = last element; baskets 0..2 left to right',
      score: state.score, cleared: state.cleared, piles: state.piles, baskets: state.baskets, preview: state.preview,
      waiting: state.waiting, capacity: state.capacity, palette: state.palette, pickCount: state.picks.length,
      lastPick: state.lastPick, active: hostActive, practice: config.practice, endReason: state.endReason
    });
  };
  var pileHandlers = pileButtons.map(function (button, i) { var handler = function () { pick(i); }; button.addEventListener('click', handler); return handler; });
  window.destroyYarn = function () {
    destroyed = true; hostActive = false; cancelAnimationFrame(frameId);
    window.removeEventListener('keydown', onKey); window.removeEventListener('message', onMessage);
    document.removeEventListener('visibilitychange', onVisibility);
    startButton.removeEventListener('click', begin); pauseButton.removeEventListener('click', pause);
    resumeButton.removeEventListener('click', resume); saveButton.removeEventListener('click', save);
    pileButtons.forEach(function (button, i) { button.removeEventListener('click', pileHandlers[i]); });
  };
  window.addEventListener('keydown', onKey); window.addEventListener('message', onMessage);
  document.addEventListener('visibilitychange', onVisibility);
  startButton.addEventListener('click', begin); pauseButton.addEventListener('click', pause);
  resumeButton.addEventListener('click', resume); saveButton.addEventListener('click', save);
  catImage.onload = function () { if (!destroyed) { mode = 'ready'; render(); } };
  catImage.onerror = function () { mode = 'error'; render(); };
  catImage.src = config.catImage;
  render(); frameId = requestAnimationFrame(loop); post('ready');
}`;
