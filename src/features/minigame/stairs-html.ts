import type { SemanticColors } from '@/constants/theme';
import { RUNNER_CAT_IDLE, RUNNER_CAT_JUMP } from '@/features/minigame/runner-character';
import { RunnerPalette } from '@/features/minigame/runner-palette';
import { STAIRS_ENGINE_SOURCE } from '@/features/minigame/stairs-engine';

export type StairsHtmlOptions = {
  seed: number;
  channelId: string;
  practice?: boolean;
  allowManualTime?: boolean;
  colors?: SemanticColors;
};

/** The self-contained document makes no network requests. */
export function createStairsHtml(options: StairsHtmlOptions): string {
  if (!Number.isInteger(options.seed) || options.seed < 1 || options.seed > 2147483647) {
    throw new Error('Invalid stairs seed');
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
main{width:100%;height:100%;position:relative;overflow:hidden}canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}
button{position:absolute;border:0;background:transparent;color:transparent;cursor:pointer;touch-action:manipulation;min-height:44px;min-width:44px}
button:focus-visible{outline:3px solid ${palette.primaryDark};outline-offset:2px;border-radius:20px}
#start-btn,#resume-btn{left:23.8%;top:45.8%;width:52.4%;height:11.54%}
#pause-btn{right:4.3%;top:3.5%;width:12.4%;height:10%}
#left-btn{left:5.7%;top:83.1%;width:42.4%;height:13.1%}
#right-btn{right:5.7%;top:83.1%;width:42.4%;height:13.1%}
[hidden]{display:none!important}
</style></head><body><main aria-label="고양이 계단 오르기">
<canvas id="game" width="420" height="520" tabindex="0" aria-label="다음 계단 방향에 맞춰 왼쪽 또는 오른쪽 버튼을 누르는 고양이 계단 오르기">고양이 계단 오르기 게임</canvas>
<button id="start-btn" aria-label="계단 오르기 시작">계단 오르기 시작</button>
<button id="pause-btn" aria-label="일시정지" hidden>일시정지</button>
<button id="resume-btn" aria-label="계속하기" hidden>계속하기</button>
<button id="left-btn" aria-label="왼쪽 계단 오르기" hidden>왼쪽 계단 오르기</button>
<button id="right-btn" aria-label="오른쪽 계단 오르기" hidden>오른쪽 계단 오르기</button>
</main><script>${STAIRS_ENGINE_SOURCE}\n(${STAIRS_BROWSER_SOURCE})(${config});</script></body></html>`;
}

const STAIRS_BROWSER_SOURCE = String.raw`function runStairs(config) {
  'use strict';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var startButton = document.getElementById('start-btn');
  var pauseButton = document.getElementById('pause-btn');
  var resumeButton = document.getElementById('resume-btn');
  var leftButton = document.getElementById('left-btn');
  var rightButton = document.getElementById('right-btn');
  var engine = createStairsEngine(config.seed);
  var state = engine.getState();
  var mode = 'loading';
  var hostActive = true;
  var pendingDirection;
  var lastTime = 0;
  var accumulator = 0;
  var frameId = 0;
  var finished = false;
  var destroyed = false;
  var manualClock = false;
  var manualRemainder = 0;
  var stepAnimation = 1;
  var previousColumn = 0;
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
  function roundRect(x,y,w,h,r,color) {
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath(); ctx.fillStyle=color;ctx.fill();
  }
  function ellipse(x,y,rx,ry,color) {
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  }
  function text(value,x,y,size,color,align) {
    ctx.font='600 '+size+'px '+FONT;ctx.textAlign=align||'left';ctx.textBaseline='middle';
    ctx.fillStyle=color||colors.ink;ctx.fillText(value,x,y);
  }
  function cloud(x,y,scale) {
    ellipse(x,y,32*scale,11*scale,colors.white);
    ellipse(x-12*scale,y-8*scale,13*scale,12*scale,colors.white);
    ellipse(x+8*scale,y-10*scale,17*scale,16*scale,colors.white);
  }
  function arrow(direction,x,y,color) {
    ctx.strokeStyle=color;ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
    var sign=direction==='LEFT'?-1:1;
    ctx.beginPath();ctx.moveTo(x-sign*10,y);ctx.lineTo(x+sign*10,y);
    ctx.moveTo(x+sign*3,y-7);ctx.lineTo(x+sign*10,y);ctx.lineTo(x+sign*3,y+7);ctx.stroke();
  }
  function scenery() {
    ctx.fillStyle=colors.sky;ctx.fillRect(0,0,420,520);
    ellipse(350,147,24,24,colors.sun);
    cloud(65,150+(state.score%9)*2,.85);cloud(344,267-(state.score%7)*2,.9);
    ellipse(46,439,178,47,colors.grassLight);ellipse(344,431,195,59,colors.grassLight);
    roundRect(44,368,26,27,5,colors.paper);roundRect(48,359,18,13,5,colors.grass);
    roundRect(352,390,24,29,4,colors.paper);roundRect(356,378,16,17,4,colors.grass);
  }
  function platform(column,y,next) {
    var x=210+column*36;
    roundRect(x-33,y,66,16,7,next?colors.primary:colors.ground);
    roundRect(x-33,y,66,5,3,next?colors.grass:colors.paper);
    if(next) {ellipse(x,y+9,3,2,colors.paper);}
  }
  function stairs() {
    var camera=(1-stepAnimation)*-38;
    platform(previousColumn,436+camera,false);
    platform(state.column,398+camera,false);
    for(var i=state.nextSteps.length-1;i>=0;i-=1) {
      platform(state.nextSteps[i].column,360-i*38+camera,i===0);
    }
    if(mode==='playing') {
      var nextX=210+state.nextSteps[0].column*36;
      arrow(state.nextSteps[0].direction,nextX,345+camera,colors.primaryDark);
    }
  }
  function cat() {
    if(imagesLoaded!==2)return;
    var jumping=stepAnimation<1;
    var image=jumping?jumpImage:idleImage;
    var ease=1-Math.pow(1-stepAnimation,2);
    var x=210+(previousColumn+(state.column-previousColumn)*ease)*36;
    var feet=398-Math.sin(stepAnimation*Math.PI)*40;
    ctx.globalAlpha=.13;ellipse(x,400,20,3,colors.ink);ctx.globalAlpha=1;
    ctx.save();ctx.translate(x,feet);
    if(mode==='ended'&&state.endReason==='wrong')ctx.rotate(.1);
    var width=94;var height=width*image.naturalHeight/image.naturalWidth;
    ctx.drawImage(image,-47,-height*(jumping?267:265)/image.naturalHeight,width,height);ctx.restore();
  }
  function pill(label) {
    roundRect(100,238,220,60,23,colors.primaryDark);
    text(label,210,269,24,colors.white,'center');
  }
  function syncButtons() {
    startButton.hidden=mode!=='ready'||!hostActive;
    pauseButton.hidden=mode!=='playing';resumeButton.hidden=mode!=='paused'||!hostActive;
    leftButton.hidden=rightButton.hidden=mode!=='playing'||!hostActive;
  }
  function render() {
    if(destroyed)return;
    scenery();stairs();cat();
    // The opaque header keeps higher stairs out of the score/timer area.
    ctx.fillStyle=colors.sky;ctx.fillRect(0,0,420,116);
    text(config.practice?'고양이 계단 · 연습':'고양이 계단',24,28,17,colors.primaryDark);
    if(mode==='playing'||mode==='paused'||mode==='ended') {
      text(state.score+' 계단',24,61,29,colors.ink);
      roundRect(24,88,300,9,5,colors.ground);
      if(state.timeLeft>0)roundRect(24,88,300*state.timeLeft/state.timeLimit,9,4,colors.primary);
    }
    if(mode==='playing') {
      text((state.timeLeft/60).toFixed(1)+'초',341,92,14,colors.muted);
      roundRect(350,18,52,52,18,colors.paper);
      roundRect(368,33,5,21,2,colors.primaryDark);roundRect(380,33,5,21,2,colors.primaryDark);
      roundRect(24,432,178,68,22,colors.paper);roundRect(218,432,178,68,22,colors.primaryDark);
      arrow('LEFT',83,466,colors.primaryDark);text('왼쪽',137,466,22,colors.primaryDark,'center');
      arrow('RIGHT',277,466,colors.white);text('오른쪽',336,466,22,colors.white,'center');
    }
    if(mode==='ready') {
      roundRect(60,174,300,146,26,colors.paper);
      text('← · →',210,206,22,colors.muted,'center');
      pill('시작');
    }
    if(mode==='paused') {
      roundRect(60,158,300,162,26,colors.paper);
      text('일시정지',210,198,26,colors.ink,'center');
      if(hostActive)pill('계속하기');
    }
    if(mode==='ended') {
      roundRect(60,148,300,166,26,colors.paper);
      text('게임 종료',210,183,23,colors.ink,'center');
      text(state.score+'점',210,231,38,colors.primaryDark,'center');
      if(state.endReason==='timeout')text('시간 초과',210,280,16,colors.muted,'center');
      else if(state.endReason==='wrong')text('잘못된 방향',210,280,16,colors.muted,'center');
    }
    if(mode==='loading'||mode==='error') {
      roundRect(24,160,372,70,24,colors.paper);
      text(mode==='loading'?'불러오는 중':'불러오기 실패',210,195,22,colors.ink,'center');
    }
    syncButtons();
  }
  function finish() {
    if(finished)return;finished=true;mode='ended';pendingDirection=undefined;
    render();post('finish',{result:{ticks:state.tick,actions:state.actions.slice()}});
  }
  function step() {
    if(mode!=='playing'||!hostActive||destroyed)return;
    var old=state;state=engine.step(pendingDirection);pendingDirection=undefined;
    if(state.score!==old.score){previousColumn=old.column;stepAnimation=0;}
    else stepAnimation=Math.min(1,stepAnimation+1/10);
    if(state.ended)finish();
  }
  function begin() {
    if(!hostActive||destroyed||mode!=='ready')return;
    mode='playing';lastTime=0;accumulator=0;canvas.focus();render();
  }
  function pause() {
    if(mode!=='playing')return;
    mode='paused';pendingDirection=undefined;accumulator=0;lastTime=0;
    post('pause',{paused:true});render();
  }
  function resume() {
    if(mode!=='paused'||!hostActive||document.hidden)return;
    mode='playing';lastTime=0;accumulator=0;canvas.focus();post('pause',{paused:false});render();
  }
  function choose(direction) {
    if(mode!=='playing'||!hostActive||destroyed||pendingDirection)return;
    pendingDirection=direction;
  }
  function left(){choose('LEFT');}function right(){choose('RIGHT');}
  function onKey(event) {
    if((event.code==='Space'||event.code==='Enter')&&event.target instanceof Element&&event.target.closest('button'))return;
    if(event.repeat)return;
    if(event.code==='ArrowLeft'||event.code==='KeyA') {event.preventDefault();choose('LEFT');}
    else if(event.code==='ArrowRight'||event.code==='KeyD') {event.preventDefault();choose('RIGHT');}
    else if(event.code==='Space'||event.code==='Enter') {
      event.preventDefault();if(mode==='ready')begin();else if(mode==='paused')resume();
    } else if(event.code==='KeyP'||event.code==='Escape') {
      event.preventDefault();if(mode==='playing')pause();else if(mode==='paused')resume();
    } else if(event.code==='KeyF') {
      if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(function(){});
      else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(function(){});
    }
  }
  function onVisibility(){if(document.hidden)pause();}
  function onMessage(event) {
    if(event.source!==window.parent||!event.data||event.data.channelId!==config.channelId)return;
    if(event.data.type==='active'&&typeof event.data.active==='boolean')window.setStairsActive(event.data.active);
    if(event.data.type==='destroy')window.destroyStairs();
  }
  function loop(now) {
    if(destroyed)return;frameId=requestAnimationFrame(loop);
    if(manualClock||mode!=='playing'||!hostActive){lastTime=0;return;}
    if(!lastTime){lastTime=now;return;}
    var elapsed=now-lastTime;lastTime=now;if(elapsed>500){pause();return;}
    accumulator+=elapsed;
    while(accumulator+.00001>=1000/60&&mode==='playing'){step();accumulator-=1000/60;}
    render();
  }
  window.setStairsActive=function(active){hostActive=active===true;if(!hostActive)pause();render();};
  window.render_game_to_text=function(){return JSON.stringify({
    gameCode:'cat-stairs',rulesVersion:2,mode:mode,
    coordinates:'420x520; origin top-left; columns -3..3 map x=210+column*36; current stair y=398; next stairs rise 38px',
    tick:state.tick,score:state.score,timeLeft:state.timeLeft,timeLimit:state.timeLimit,active:hostActive,
    practice:config.practice,manualTime:config.manualTime,character:'rougether-cat',
    column:state.column,nextSteps:state.nextSteps,actionCount:state.actions.length,endReason:state.endReason
  });};
  if(config.manualTime)window.advanceTime=function(ms){
    if(!Number.isFinite(ms)||ms<0||ms>120000)return;
    manualClock=true;lastTime=0;manualRemainder+=ms*60/1000;
    var ticks=Math.floor(manualRemainder+.00001);manualRemainder-=ticks;
    for(var i=0;i<ticks&&mode==='playing';i+=1)step();render();
  };else delete window.advanceTime;
  window.destroyStairs=function(){
    destroyed=true;hostActive=false;cancelAnimationFrame(frameId);
    window.removeEventListener('keydown',onKey);window.removeEventListener('message',onMessage);
    document.removeEventListener('visibilitychange',onVisibility);
    startButton.removeEventListener('click',begin);pauseButton.removeEventListener('click',pause);
    resumeButton.removeEventListener('click',resume);leftButton.removeEventListener('click',left);rightButton.removeEventListener('click',right);
  };
  window.addEventListener('keydown',onKey);window.addEventListener('message',onMessage);
  document.addEventListener('visibilitychange',onVisibility);
  startButton.addEventListener('click',begin);pauseButton.addEventListener('click',pause);
  resumeButton.addEventListener('click',resume);leftButton.addEventListener('click',left);rightButton.addEventListener('click',right);
  function onImageLoaded(){imagesLoaded+=1;if(imagesLoaded===2&&!destroyed){mode='ready';render();}}
  function onImageError(){mode='error';render();}
  idleImage.onload=onImageLoaded;jumpImage.onload=onImageLoaded;idleImage.onerror=onImageError;jumpImage.onerror=onImageError;
  idleImage.src=config.idleImage;jumpImage.src=config.jumpImage;
  render();frameId=requestAnimationFrame(loop);post('ready');
}`;
