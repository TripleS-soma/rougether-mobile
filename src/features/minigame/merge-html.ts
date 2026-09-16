import type { SemanticColors } from '@/constants/theme';
import { MERGE_ENGINE_SOURCE } from '@/features/minigame/merge-engine';
import {
  escapeHtml,
  getMinigameCopy,
  MINIGAME_FMT_SOURCE,
  minigameDocumentLanguage,
} from '@/features/minigame/minigame-copy';
import { RUNNER_CAT_IDLE } from '@/features/minigame/runner-character';
import { RunnerPalette } from '@/features/minigame/runner-palette';

export type MergeHtmlOptions = {
  seed: number;
  channelId: string;
  practice?: boolean;
  allowManualTime?: boolean;
  colors?: SemanticColors;
};

/** The complete document is bundled and has no network or storage access. */
export function createMergeHtml(options: MergeHtmlOptions): string {
  if (!Number.isInteger(options.seed) || options.seed < 1 || options.seed > 2147483647) {
    throw new Error('Invalid merge seed');
  }
  const copy = getMinigameCopy('merge');
  const h = (key: string) => escapeHtml(copy[key] ?? '');
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
    catImage: RUNNER_CAT_IDLE,
    copy,
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="${minigameDocumentLanguage()}"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${palette.sky};touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none}
main{width:100%;height:100%;position:relative;overflow:hidden}
html:fullscreen body{display:grid;place-items:center}
html:fullscreen main{width:min(100vw,66.6667vh);height:min(100vh,150vw)}
canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}
button{position:absolute;border:0;background:transparent;color:transparent;cursor:pointer;touch-action:manipulation;min-height:44px;min-width:44px}
button:focus-visible{outline:3px solid ${palette.primaryDark};outline-offset:-2px;border-radius:16px}
#start-btn,#resume-btn{left:25%;top:47.33%;width:50%;height:9.33%}
#pause-btn{right:4%;top:2.66%;width:12%;height:9%}
.direction{top:75.33%;width:20%;height:8.66%}
#up-btn{left:5%}#right-btn{left:28.3%}#down-btn{left:51.7%}#left-btn{left:75%}
#save-btn{left:12.5%;top:88.33%;width:75%;height:9%}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
[hidden]{display:none!important}
</style></head><body><main aria-label="${h('mainA11y')}">
<canvas id="game" width="800" height="1200" tabindex="0" aria-label="${h('canvasA11y')}">${h('canvasFallback')}</canvas>
<p id="game-status" class="sr-only" role="status" aria-live="polite"></p>
<button id="start-btn" aria-label="${h('startA11y')}">${h('startA11y')}</button>
<button id="pause-btn" aria-label="${h('pauseA11y')}" hidden>${h('pauseA11y')}</button>
<button id="resume-btn" aria-label="${h('resume')}" hidden>${h('resume')}</button>
<button id="up-btn" class="direction" aria-label="${h('upA11y')}" hidden>${h('upA11y')}</button>
<button id="right-btn" class="direction" aria-label="${h('rightA11y')}" hidden>${h('rightA11y')}</button>
<button id="down-btn" class="direction" aria-label="${h('downA11y')}" hidden>${h('downA11y')}</button>
<button id="left-btn" class="direction" aria-label="${h('leftA11y')}" hidden>${h('leftA11y')}</button>
<button id="save-btn" aria-label="${h('saveA11y')}" hidden>${h('saveA11y')}</button>
</main><script>${MERGE_ENGINE_SOURCE}\n${MINIGAME_FMT_SOURCE}\n(${MERGE_BROWSER_SOURCE})(${config});</script></body></html>`;
}

const MERGE_BROWSER_SOURCE = String.raw`function runMerge(config) {
  'use strict';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  var startButton = document.getElementById('start-btn');
  var pauseButton = document.getElementById('pause-btn');
  var resumeButton = document.getElementById('resume-btn');
  var saveButton = document.getElementById('save-btn');
  var status = document.getElementById('game-status');
  var copy = config.copy;
  saveButton.setAttribute('aria-label',config.practice?copy.practiceStopA11y:copy.saveA11y);
  var directionButtons = ['up-btn', 'right-btn', 'down-btn', 'left-btn'].map(function (id) { return document.getElementById(id); });
  var names = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
  var engine = createMergeEngine(config.seed);
  var state = engine.getState();
  var mode = 'loading';
  var hostActive = true;
  var ticks = 0;
  var actions = [];
  var lastTime = 0;
  var accumulator = 0;
  var frameId = 0;
  var finished = false;
  var destroyed = false;
  var manualClock = false;
  var manualRemainder = 0;
  var pointerStart = null;
  var colors = config.palette;
  var catImage = new Image();
  var imagesLoaded = false;
  var lastMerge = 0;
  var glowTicks = 0;
  var endReason = null;
  var FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  function post(type, extra) {
    var message = { channelId: config.channelId, type: type };
    if (extra) Object.keys(extra).forEach(function (key) { message[key] = extra[key]; });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else if (window.parent !== window) window.parent.postMessage(message, '*');
  }
  function box(x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  }
  function text(value, x, y, size, color, align) {
    ctx.font='600 '+size+'px '+FONT; ctx.textAlign=align||'left';
    ctx.textBaseline='middle'; ctx.fillStyle=color||colors.ink; ctx.fillText(value,x,y);
  }
  function cat(x, y, width) {
    if (imagesLoaded) ctx.drawImage(catImage,x,y,width,width*catImage.naturalHeight/catImage.naturalWidth);
  }
  function syncButtons() {
    startButton.hidden=mode!=='ready'||!hostActive;
    resumeButton.hidden=mode!=='paused'||!hostActive;
    pauseButton.hidden=mode!=='playing'||!hostActive;
    saveButton.hidden=(mode!=='playing'&&mode!=='paused')||!hostActive;
    directionButtons.forEach(function(button){button.hidden=mode!=='playing'||!hostActive;});
  }
  function announce() {
    status.textContent=fmt(copy.statusScore,{score:state.score,moves:state.directions.length})+' '+
      (mode==='ended'?copy.statusEnded+' ':mode==='paused'?copy.statusPaused+' ':'')+
      (state.movesUntilExtraTile===null?'':fmt(copy.statusExtraTile,{n:state.movesUntilExtraTile})+' ')+
      state.board.map(function(value,index){return (index%4===0?' '+fmt(copy.statusRow,{row:Math.floor(index/4)+1})+' ':'')+(value||copy.statusEmpty);}).join(', ');
  }
  function render() {
    if(destroyed)return;
    ctx.fillStyle=colors.sky;ctx.fillRect(0,0,400,600);
    cat(12,5,75);
    text(config.practice?copy.titlePractice:copy.title,86,25,15,colors.primaryDark);
    text(fmt(copy.points,{score:state.score}),86,53,25,colors.ink);
    if(lastMerge>0&&glowTicks>0)text('+'+lastMerge,218,53,14,colors.primaryDark,'right');
    if(mode==='playing'){
      box(228,41,102,25,12,colors.paper);
      text(fmt(copy.extraTile,{n:state.movesUntilExtraTile}),279,54,11,colors.primaryDark,'center');
      box(338,16,46,48,16,colors.paper);
      box(353,30,5,20,2,colors.primaryDark);box(364,30,5,20,2,colors.primaryDark);
    }
    box(20,80,360,360,22,colors.ground);
    var tileColors=[colors.paper,colors.bearLight,colors.grassLight,colors.grass,colors.sun,colors.bear,colors.primary];
    for(var i=0;i<16;i++){
      var value=state.board[i],x=29+(i%4)*87,y=89+Math.floor(i/4)*87;
      var level=value?Math.log2(value)-1:0;
      box(x,y,81,81,15,value?tileColors[Math.min(level,tileColors.length-1)]:colors.sky);
      if(value){
        cat(x+14,y+1,53);
        text(String(value),x+40.5,y+63,value>=1024?22:27,level>=6?colors.white:colors.ink,'center');
      }
    }
    if(mode==='playing'){
      ['↑','→','↓','←'].forEach(function(label,index){box(20+index*93.33,452,80,52,16,colors.paper);text(label,60+index*93.33,478,28,colors.primaryDark,'center');});
    }
    if(mode==='playing'||mode==='paused'){
      box(50,530,300,54,17,colors.paper);
      text(config.practice?copy.stopButton:copy.saveButton,200,557,17,colors.primaryDark,'center');
    }
    if(mode==='ready'||mode==='paused'||mode==='ended'){
      ctx.fillStyle='rgba(255,253,244,0.88)';ctx.fillRect(20,80,360,360);
      cat(147,107,106);
      if(mode!=='ready')text(mode==='paused'?copy.paused:copy.gameOver,200,242,23,colors.ink,'center');
      if(mode==='ended'){
        text(fmt(copy.points,{score:state.score}),200,294,38,colors.primaryDark,'center');
        if(endReason==='blocked')text(copy.blocked,200,342,15,colors.muted,'center');
      }else{
        if(mode==='ready')text(copy.hint,200,244,17,colors.muted,'center');
        if(hostActive){box(100,284,200,56,20,colors.primaryDark);text(mode==='ready'?copy.start:copy.resume,200,312,21,colors.white,'center');}
      }
    }
    if(mode==='loading'||mode==='error'){
      box(20,80,360,360,22,colors.paper);
      text(mode==='loading'?copy.loading:copy.loadFailed,200,252,19,colors.ink,'center');
    }
    syncButtons();
  }
  function finish(reason) {
    if(finished||destroyed)return;
    finished=true;endReason=reason||state.endReason||'saved';
    if(!state.ended)state=engine.finish();
    mode='ended';pointerStart=null;ticks=Math.max(1,ticks);
    render();announce();
    post('finish',{result:{ticks:ticks,actions:actions.map(function(action){return {tick:action.tick,direction:action.direction};})}});
  }
  function step() {
    if(mode!=='playing'||!hostActive||destroyed)return;
    ticks+=1;if(glowTicks>0)glowTicks-=1;
    if(ticks>=18000)finish('limit');
  }
  function begin() {
    if(mode!=='ready'||!hostActive||destroyed||document.hidden)return;
    mode='playing';lastTime=0;accumulator=0;canvas.focus();render();announce();
  }
  function pause() {
    if(mode!=='playing')return;
    mode='paused';pointerStart=null;lastTime=0;accumulator=0;
    post('pause',{paused:true});render();announce();
  }
  function resume() {
    if(mode!=='paused'||!hostActive||destroyed||document.hidden)return;
    mode='playing';lastTime=0;accumulator=0;canvas.focus();post('pause',{paused:false});render();announce();
  }
  function move(direction) {
    if(mode!=='playing'||!hostActive||destroyed)return;
    var before=state;
    state=engine.move(direction);
    if(state.directions.length===before.directions.length)return;
    var tick=Math.max(1,ticks,actions.length?actions[actions.length-1].tick+1:1);
    ticks=tick;actions.push({tick:tick,direction:names[direction]});
    lastMerge=state.score-before.score;glowTicks=30;
    if(state.ended)finish(state.endReason);else if(ticks>=18000)finish('limit');else{render();announce();}
  }
  function save() {if(hostActive&&(mode==='playing'||mode==='paused'))finish('saved');}
  function onPointerDown(event) {
    if(mode!=='playing'||!hostActive||!event.isPrimary)return;
    event.preventDefault();canvas.focus();pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};
    if(canvas.setPointerCapture)canvas.setPointerCapture(event.pointerId);
  }
  function onPointerUp(event) {
    if(!pointerStart||event.pointerId!==pointerStart.id)return;
    var dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;
    pointerStart=null;event.preventDefault();
    if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;
    move(Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0));
  }
  function onPointerCancel(){pointerStart=null;}
  function onKey(event) {
    if((event.code==='Space'||event.code==='Enter')&&event.target instanceof Element&&event.target.closest('button'))return;
    var direction=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].indexOf(event.code);
    if(direction>=0){event.preventDefault();if(!event.repeat)move(direction);}
    else if(event.code==='Space'||event.code==='Enter'){
      event.preventDefault();if(event.repeat)return;
      if(mode==='ready')begin();else if(mode==='paused')resume();
    }else if(event.code==='KeyP'||event.code==='Escape'){
      event.preventDefault();if(event.repeat)return;
      if(mode==='playing')pause();else if(mode==='paused')resume();
    }else if(event.code==='KeyF'&&!event.repeat){
      if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(function(){});
      else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(function(){});
    }
  }
  function onVisibility(){if(document.hidden)pause();}
  function onMessage(event){
    if(event.source!==window.parent||!event.data||event.data.channelId!==config.channelId)return;
    if(event.data.type==='active'&&typeof event.data.active==='boolean')window.setMergeActive(event.data.active);
    if(event.data.type==='destroy')window.destroyMerge();
  }
  function loop(now){
    if(destroyed)return;frameId=requestAnimationFrame(loop);
    if(manualClock||mode!=='playing'||!hostActive){lastTime=0;return;}
    if(!lastTime){lastTime=now;return;}
    var elapsed=now-lastTime;lastTime=now;
    if(elapsed>500){pause();return;}
    accumulator+=elapsed;
    while(accumulator+0.00001>=1000/60&&mode==='playing'){step();accumulator-=1000/60;}
    render();
  }
  window.setMergeActive=function(active){hostActive=active===true;if(!hostActive)pause();render();};
  window.render_game_to_text=function(){return JSON.stringify({
    gameCode:'cat-merge',rulesVersion:2,mode:mode,coordinates:'4x4 row-major; origin top-left; directions UP RIGHT DOWN LEFT',
    ticks:ticks,score:state.score,board:state.board,moveCount:state.directions.length,movesUntilExtraTile:state.movesUntilExtraTile,
    active:hostActive,practice:config.practice,manualTime:config.manualTime,character:'rougether-cat',endReason:endReason,
    lastAction:actions.length?actions[actions.length-1]:null
  });};
  if(config.manualTime){window.advanceTime=function(ms){
    if(!Number.isFinite(ms)||ms<0||ms>300000)return;
    manualClock=true;lastTime=0;manualRemainder+=ms*60/1000;
    var count=Math.floor(manualRemainder+0.00001);manualRemainder-=count;
    for(var i=0;i<count&&mode==='playing';i+=1)step();render();
  };}else delete window.advanceTime;
  var directionHandlers=directionButtons.map(function(button,index){var handler=function(){move(index);};button.addEventListener('click',handler);return handler;});
  window.destroyMerge=function(){
    destroyed=true;hostActive=false;pointerStart=null;cancelAnimationFrame(frameId);
    canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('pointercancel',onPointerCancel);
    window.removeEventListener('keydown',onKey);window.removeEventListener('message',onMessage);document.removeEventListener('visibilitychange',onVisibility);
    startButton.removeEventListener('click',begin);pauseButton.removeEventListener('click',pause);resumeButton.removeEventListener('click',resume);saveButton.removeEventListener('click',save);
    directionButtons.forEach(function(button,index){button.removeEventListener('click',directionHandlers[index]);});
  };
  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',onPointerCancel);
  window.addEventListener('keydown',onKey);window.addEventListener('message',onMessage);document.addEventListener('visibilitychange',onVisibility);
  startButton.addEventListener('click',begin);pauseButton.addEventListener('click',pause);resumeButton.addEventListener('click',resume);saveButton.addEventListener('click',save);
  catImage.onload=function(){imagesLoaded=true;if(!destroyed){mode='ready';render();}};
  catImage.onerror=function(){mode='error';render();};catImage.src=config.catImage;
  render();frameId=requestAnimationFrame(loop);post('ready');
}`;
