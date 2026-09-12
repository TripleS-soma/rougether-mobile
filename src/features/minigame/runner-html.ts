import type { SemanticColors } from '@/constants/theme';
import { RUNNER_CAT_IDLE, RUNNER_CAT_JUMP } from '@/features/minigame/runner-character';
import { RUNNER_ENGINE_SOURCE } from '@/features/minigame/runner-engine';
import { RunnerPalette } from '@/features/minigame/runner-palette';

export type RunnerHtmlOptions = {
  seed: number;
  channelId: string;
  practice?: boolean;
  allowManualTime?: boolean;
  colors?: SemanticColors;
};

/** All inputs are JSON encoded; the document loads no external scripts or assets. */
export function createRunnerHtml(options: RunnerHtmlOptions): string {
  if (!Number.isInteger(options.seed) || options.seed < 1 || options.seed > 2147483647) {
    throw new Error('Invalid runner seed');
  }
  const t = options.colors;
  const palette = t
    ? {
        ...RunnerPalette,
        sky: t.screen,
        paper: t.surfaceMuted,
        ink: t.onTint,
        muted: t.textMuted,
        primary: t.primary,
        primaryDark: t.primaryText,
        grass: t.grass,
        ground: t.border,
      }
    : RunnerPalette;
  const config = JSON.stringify({
    seed: options.seed,
    channelId: options.channelId,
    practice: options.practice === true,
    manualTime: options.practice === true && options.allowManualTime === true,
    palette,
    idleImage: RUNNER_CAT_IDLE,
    jumpImage: RUNNER_CAT_JUMP,
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${palette.sky};touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none}
main{width:100%;height:100%;position:relative;overflow:hidden}
canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}
button{position:absolute;border:0;background:transparent;color:transparent;cursor:pointer;touch-action:manipulation;min-height:44px;min-width:44px}
button:focus-visible{outline:3px solid ${palette.primaryDark};outline-offset:2px;border-radius:20px}
#start-btn,#resume-btn{left:34.7%;top:49.3%;width:30.6%;height:15.7%}
#pause-btn{right:2.8%;top:3.8%;width:9.2%;height:13.3%}
[hidden]{display:none!important}
</style></head><body><main aria-label="고양이 달리기">
<canvas id="game" width="720" height="420" tabindex="0" aria-label="화면을 탭하거나 스페이스 키를 눌러 점프하는 고양이 달리기">고양이 달리기 게임</canvas>
<button id="start-btn" aria-label="달리기 시작">달리기 시작</button>
<button id="pause-btn" aria-label="일시정지" hidden>일시정지</button>
<button id="resume-btn" aria-label="계속하기" hidden>계속하기</button>
</main><script>${RUNNER_ENGINE_SOURCE}\n(${RUNNER_BROWSER_SOURCE})(${config});</script></body></html>`;
}

const RUNNER_BROWSER_SOURCE = String.raw`function runRunner(config) {
  'use strict';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var startButton = document.getElementById('start-btn');
  var pauseButton = document.getElementById('pause-btn');
  var resumeButton = document.getElementById('resume-btn');
  var engine = createRunnerEngine(config.seed);
  var state = engine.getState();
  var mode = 'loading';
  var hostActive = true;
  var pendingJump = false;
  var lastTime = 0;
  var accumulator = 0;
  var distance = 0;
  var frameId = 0;
  var finished = false;
  var destroyed = false;
  var manualClock = false;
  var manualRemainder = 0;
  var colors = config.palette;
  var imagesLoaded = 0;
  var idleImage = new Image();
  var jumpImage = new Image();
  var FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  function post(type, extra) {
    var message = { channelId: config.channelId, type: type };
    if (extra) Object.keys(extra).forEach(function (key) { message[key] = extra[key]; });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else if (window.parent !== window) window.parent.postMessage(message, '*');
  }
  function roundRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function ellipse(x, y, rx, ry, fill) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
  }
  function text(value, x, y, size, color, align) {
    ctx.font = '600 ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color || colors.ink;
    ctx.fillText(value, x, y);
  }
  function cloud(x, y, scale) {
    ellipse(x, y, 34 * scale, 12 * scale, colors.white);
    ellipse(x - 13 * scale, y - 8 * scale, 14 * scale, 13 * scale, colors.white);
    ellipse(x + 9 * scale, y - 12 * scale, 19 * scale, 17 * scale, colors.white);
  }
  function scenery() {
    ctx.fillStyle = colors.sky; ctx.fillRect(0, 0, 720, 420);
    ellipse(593, 99, 29, 29, colors.sun);
    cloud(153 - (distance * 0.04 % 870), 96, 0.75);
    cloud(445 - (distance * 0.025 % 980), 143, 1);
    cloud(847 - (distance * 0.04 % 870), 96, 0.75);
    ellipse(100, 333, 239, 78, colors.grassLight);
    ellipse(596, 341, 280, 108, colors.grassLight);
    // Familiar little houses stay behind the playable garden path.
    for (var i = 0; i < 3; i += 1) {
      var x = ((i * 284 + 410 - distance * 0.14) % 980 + 980) % 980 - 110;
      var y = 248 + (i % 2) * 15;
      roundRect(x, y, 67, 62, 9, colors.paper);
      ctx.beginPath(); ctx.moveTo(x - 7, y + 5); ctx.lineTo(x + 33, y - 24); ctx.lineTo(x + 75, y + 5);
      ctx.closePath(); ctx.fillStyle = colors.grass; ctx.fill();
      roundRect(x + 13, y + 16, 16, 18, 4, colors.ground);
      roundRect(x + 40, y + 21, 15, 41, 5, colors.ground);
    }
    ctx.fillStyle = colors.grass; ctx.fillRect(0, 327, 720, 13);
    ctx.fillStyle = colors.ground; ctx.fillRect(0, 340, 720, 80);
    ctx.fillStyle = colors.paper; ctx.fillRect(0, 340, 720, 4);
    for (var p = 0; p < 15; p += 1) {
      var pebbleX = ((p * 67 - distance) % 1020 + 1020) % 1020;
      roundRect(pebbleX, 365 + (p % 3) * 14, 8 + (p % 2) * 7, 3, 1.5, colors.paper);
    }
  }
  function obstacle(o) {
    var top = 340 - o.height;
    // A solid terracotta planter accurately fills the collision rectangle.
    roundRect(o.x, top, o.width, o.height, 4, colors.pot);
    roundRect(o.x, top, o.width, 9, 3, colors.potDark);
    roundRect(o.x + 4, top + 12, 4, Math.max(3, o.height - 19), 2, colors.bearLight);
    ellipse(o.x + o.width / 2 - 3, top - 4, 7, 3, colors.primary);
    ellipse(o.x + o.width / 2 + 5, top - 7, 6, 3, colors.primaryDark);
  }
  function cat() {
    var airborne = state.playerY > 0;
    var bob = !airborne && mode === 'playing' ? Math.sin(state.tick * 0.58) * 2 : 0;
    ctx.globalAlpha = 0.16;
    ellipse(115, 339, airborne ? 18 : 27, 4, colors.ink);
    ctx.globalAlpha = 1;
    if (imagesLoaded === 2) {
      var image = airborne ? jumpImage : idleImage;
      // Preserve the complete 332x285 artwork; align its opaque paws with the ground.
      ctx.save();
      ctx.translate(115, 340 - state.playerY + bob);
      if (mode === 'ended') ctx.rotate(-0.08);
      var spriteWidth = 94;
      var spriteHeight = spriteWidth * image.naturalHeight / image.naturalWidth;
      var pawBaseline = airborne ? 267 : 265;
      ctx.drawImage(image, -47, -spriteHeight * pawBaseline / image.naturalHeight, spriteWidth, spriteHeight);
      ctx.restore();
    }
  }
  function pill(label) {
    roundRect(250, 207, 220, 66, 24, colors.primaryDark);
    text(label, 360, 240, 28, colors.white, 'center');
  }
  function syncButtons() {
    startButton.hidden = mode !== 'ready' || !hostActive;
    pauseButton.hidden = mode !== 'playing';
    resumeButton.hidden = mode !== 'paused' || !hostActive;
  }
  function render() {
    if (destroyed) return;
    scenery();
    state.obstacles.forEach(obstacle);
    cat();
    text(config.practice ? '루틴 러너 · 연습' : '루틴 러너', 26, 35, 20, colors.primaryDark);
    if (mode === 'playing' || mode === 'paused' || mode === 'ended') {
      text(String(state.score).padStart(4, '0'), 28, 71, 33, colors.ink);
    }
    if (mode === 'playing') {
      roundRect(634, 16, 66, 56, 20, colors.paper);
      roundRect(657, 32, 6, 24, 2, colors.primaryDark);
      roundRect(670, 32, 6, 24, 2, colors.primaryDark);
    }
    if (mode === 'ready') {
      text('탭 · 스페이스 · ↑', 360, 169, 20, colors.muted, 'center');
      pill('시작');
    }
    if (mode === 'paused') {
      ctx.fillStyle = 'rgba(255,253,244,0.76)'; ctx.fillRect(0, 90, 720, 220);
      text('일시정지', 360, 162, 32, colors.ink, 'center');
      if (hostActive) pill('계속하기');
    }
    if (mode === 'ended') {
      roundRect(220, 125, 280, 140, 26, colors.paper);
      text('게임 종료', 360, 163, 26, colors.ink, 'center');
      text(state.score + '점', 360, 216, 44, colors.primaryDark, 'center');
    }
    if (mode === 'loading' || mode === 'error') {
      text(mode === 'loading' ? '불러오는 중' : '불러오기 실패', 360, 180, 28, colors.ink, 'center');
    }
    syncButtons();
  }
  function finish() {
    if (finished) return;
    finished = true;
    mode = 'ended';
    pendingJump = false;
    render();
    post('finish', { result: { ticks: state.tick, jumpTicks: state.jumpTicks.slice() } });
  }
  function step() {
    if (mode !== 'playing' || !hostActive || destroyed) return;
    state = engine.step(pendingJump);
    pendingJump = false;
    distance += state.speed;
    if (state.ended) finish();
  }
  function begin() {
    if (!hostActive || destroyed || mode !== 'ready') return;
    mode = 'playing'; lastTime = 0; accumulator = 0;
    canvas.focus(); render();
  }
  function pause() {
    if (mode !== 'playing') return;
    mode = 'paused'; pendingJump = false; accumulator = 0; lastTime = 0;
    post('pause', { paused: true }); render();
  }
  function resume() {
    if (mode !== 'paused' || !hostActive || document.hidden) return;
    mode = 'playing'; lastTime = 0; accumulator = 0;
    canvas.focus(); post('pause', { paused: false }); render();
  }
  function jump() {
    if (mode === 'ready') { begin(); return; }
    if (mode === 'paused') { resume(); return; }
    if (mode === 'playing' && hostActive && state.playerY === 0) pendingJump = true;
  }
  function onPointer(event) {
    event.preventDefault(); jump();
  }
  function onKey(event) {
    if ((event.code === 'Space' || event.code === 'Enter') &&
        event.target instanceof Element && event.target.closest('button')) return;
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      if (!event.repeat) jump();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault();
      if (event.repeat) return;
      if (mode === 'playing') pause(); else if (mode === 'paused') resume();
    } else if (event.code === 'KeyF') {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    }
  }
  function onVisibility() { if (document.hidden) pause(); }
  function onMessage(event) {
    if (event.source !== window.parent || !event.data || event.data.channelId !== config.channelId) return;
    if (event.data.type === 'active' && typeof event.data.active === 'boolean') window.setRunnerActive(event.data.active);
    if (event.data.type === 'destroy') window.destroyRunner();
  }
  function loop(now) {
    if (destroyed) return;
    frameId = requestAnimationFrame(loop);
    if (manualClock || mode !== 'playing' || !hostActive) { lastTime = 0; return; }
    if (!lastTime) { lastTime = now; return; }
    var elapsed = now - lastTime;
    lastTime = now;
    // A suspended WebView cannot silently run a burst of unseen collisions.
    if (elapsed > 500) { pause(); return; }
    accumulator += elapsed;
    while (accumulator + 0.00001 >= 1000 / 60 && mode === 'playing') {
      step(); accumulator -= 1000 / 60;
    }
    render();
  }
  window.setRunnerActive = function (active) {
    hostActive = active === true;
    if (!hostActive) pause();
    render();
  };
  window.render_game_to_text = function () {
    return JSON.stringify({
      gameCode: 'room-runner', rulesVersion: 2, mode: mode,
      coordinates: '720x420; origin top-left; x right; playerY is feet height above groundY=340',
      tick: state.tick, score: state.score, speed: state.speed, active: hostActive,
      practice: config.practice, manualTime: config.manualTime, character: 'rougether-cat',
      player: { x: 100, y: state.playerY, vy: state.playerVy, width: 30, height: 38 },
      obstacles: state.obstacles, jumpCount: state.jumpTicks.length, endReason: state.endReason
    });
  };
  if (config.manualTime) {
    window.advanceTime = function (ms) {
      if (!Number.isFinite(ms) || ms < 0 || ms > 300000) return;
      manualClock = true; lastTime = 0;
      manualRemainder += ms * 60 / 1000;
      var ticks = Math.floor(manualRemainder + 0.00001);
      manualRemainder -= ticks;
      for (var i = 0; i < ticks && mode === 'playing'; i += 1) step();
      render();
    };
  } else {
    delete window.advanceTime;
  }
  window.destroyRunner = function () {
    destroyed = true; hostActive = false;
    cancelAnimationFrame(frameId);
    canvas.removeEventListener('pointerdown', onPointer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('message', onMessage);
    document.removeEventListener('visibilitychange', onVisibility);
    startButton.removeEventListener('click', begin);
    pauseButton.removeEventListener('click', pause);
    resumeButton.removeEventListener('click', resume);
  };
  canvas.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  window.addEventListener('message', onMessage);
  document.addEventListener('visibilitychange', onVisibility);
  startButton.addEventListener('click', begin);
  pauseButton.addEventListener('click', pause);
  resumeButton.addEventListener('click', resume);
  function onImageLoaded() {
    imagesLoaded += 1;
    if (imagesLoaded === 2 && !destroyed) { mode = 'ready'; render(); }
  }
  function onImageError() { mode = 'error'; render(); }
  idleImage.onload = onImageLoaded; jumpImage.onload = onImageLoaded;
  idleImage.onerror = onImageError; jumpImage.onerror = onImageError;
  idleImage.src = config.idleImage; jumpImage.src = config.jumpImage;
  render(); frameId = requestAnimationFrame(loop); post('ready');
}`;
