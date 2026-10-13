import { CURRENT_MINIGAME_RULES_VERSION } from '@/constants/minigames';
import type { SemanticColors } from '@/constants/theme';
import {
  escapeHtml,
  getMinigameCopy,
  MINIGAME_FMT_SOURCE,
  minigameDocumentLanguage,
} from '@/features/minigame/minigame-copy';
import { RUNNER_CAT_IDLE, RUNNER_CAT_JUMP } from '@/features/minigame/runner-character';
import { RunnerPalette } from '@/features/minigame/runner-palette';
import { TOWER_ENGINE_SOURCE } from '@/features/minigame/tower-engine';

export type TowerHtmlOptions = {
  seed: number;
  channelId: string;
  practice?: boolean;
  allowManualTime?: boolean;
  colors?: SemanticColors;
};

/**
 * 고양이 탑 쌓기 문서 (#1529). 계단과 같은 세로 420×520 캔버스·같은 테마 팔레트·같은 고양이
 * 그림을 쓴다. 상자 색은 테마 primary에서 층마다 조금씩 비튼다. 잘려 나가는 조각·퍼펙트
 * 반짝임·카메라 이동은 표시용일 뿐 엔진 상태(서버 검증)와 무관하다.
 * The self-contained document makes no network requests.
 */
export function createTowerHtml(options: TowerHtmlOptions): string {
  if (!Number.isInteger(options.seed) || options.seed < 1 || options.seed > 2147483647) {
    throw new Error('Invalid tower seed');
  }
  const copy = getMinigameCopy('tower');
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
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    channelId: options.channelId,
    practice: options.practice === true,
    manualTime: options.practice === true && options.allowManualTime === true,
    palette,
    idleImage: RUNNER_CAT_IDLE,
    jumpImage: RUNNER_CAT_JUMP,
    copy,
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="${minigameDocumentLanguage()}"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${palette.sky};touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none}
main{width:100%;height:100%;position:relative;overflow:hidden}canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}
button{position:absolute;border:0;background:transparent;color:transparent;cursor:pointer;touch-action:manipulation;min-height:44px;min-width:44px}
button:focus-visible{outline:3px solid ${palette.primaryDark};outline-offset:2px;border-radius:20px}
#start-btn,#resume-btn{left:23.8%;top:45.8%;width:52.4%;height:11.54%}
#pause-btn{right:4.3%;top:3.5%;width:12.4%;height:10%}
[hidden]{display:none!important}
</style></head><body><main aria-label="${h('mainA11y')}">
<canvas id="game" width="420" height="520" tabindex="0" aria-label="${h('canvasA11y')}">${h('canvasFallback')}</canvas>
<button id="start-btn" aria-label="${h('startA11y')}">${h('startA11y')}</button>
<button id="pause-btn" aria-label="${h('pauseA11y')}" hidden>${h('pauseA11y')}</button>
<button id="resume-btn" aria-label="${h('resume')}" hidden>${h('resume')}</button>
</main><script>${ENGINE_SCRIPT}\n${MINIGAME_FMT_SOURCE}\n(${TOWER_BROWSER_SOURCE})(${config});</script></body></html>`;
}

/**
 * 엔진 소스의 한 줄 주석(한국어)은 문서에 싣지 않는다 — 영어 문서에 한글이 남지 않게(#893).
 * 주석 줄만 지우므로 실행 코드는 픽스처로 검증한 그대로다.
 */
const ENGINE_SCRIPT = TOWER_ENGINE_SOURCE.replace(/^[ \t]*\/\/.*$/gm, '');

const TOWER_BROWSER_SOURCE = String.raw`function runTower(config) {
  'use strict';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var startButton = document.getElementById('start-btn');
  var pauseButton = document.getElementById('pause-btn');
  var resumeButton = document.getElementById('resume-btn');
  var engine = createTowerEngine(config.seed, config.rulesVersion);
  var state = engine.getState();
  var mode = 'loading';
  var hostActive = true;
  var pendingDrop = false;
  var lastTime = 0;
  var accumulator = 0;
  var frameId = 0;
  var fxTime = 0;
  var finished = false;
  var destroyed = false;
  var manualClock = false;
  var manualRemainder = 0;
  var colors = config.palette;
  var copy = config.copy;
  var imagesLoaded = 0;
  var idleImage = new Image();
  var jumpImage = new Image();
  var FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  // Stage 1000 units -> 384px. LH = layer height; GROUND = base bottom edge at camera 0.
  var X0 = 18, SCALE = 0.384, LH = 24, GROUND = 490, TOP_LINE = 400, HOVER = 78, HUD = 112;
  var camera = 0;
  // Display-only effects; never part of the engine state.
  var fall = null;      // the newly placed box falling into place {t}
  var hop = null;       // the cat hopping onto the new top {t, fromX, toX, fromY}
  var pieces = [];      // trimmed pieces falling away {x, w, y, vy, rot, spin, age, wait, color}
  var flash = null;     // perfect drop sparkle {t, x, w, y}
  var baseHsl = parseColor(colors.primary);
  function post(type, extra) {
    var message = { channelId: config.channelId, type: type };
    if (extra) Object.keys(extra).forEach(function (key) { message[key] = extra[key]; });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else if (window.parent !== window) window.parent.postMessage(message, '*');
  }
  function parseColor(value) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(value || ''));
    if (!m) return null;
    var n = parseInt(m[1], 16);
    var r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, hh = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hh = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh *= 60;
    }
    return { h: hh, s: s * 100, l: l * 100 };
  }
  // Each layer nudges the theme primary's hue and lightness along a sine, staying near the theme.
  function layerColor(i) {
    if (!baseHsl) return colors.primary;
    var hue = (baseHsl.h + 12 * Math.sin(i * 0.45) + 360) % 360;
    var light = Math.max(28, Math.min(78, baseHsl.l + 8 * Math.sin(i * 0.8 + 1)));
    return 'hsl(' + hue.toFixed(1) + ',' + baseHsl.s.toFixed(1) + '%,' + light.toFixed(1) + '%)';
  }
  function roundRect(x,y,w,h,r,color) {
    r=Math.max(0,Math.min(r,w/2,h/2));
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
  function sx(x){return X0+x*SCALE;}
  // Screen y of the top edge of layer i (base = 0).
  function layerTop(i){return GROUND-(i+1)*LH+camera;}
  function block(x,w,top,color) {
    var px=sx(x),pw=w*SCALE;
    roundRect(px,top,pw,LH,4,color);
    ctx.globalAlpha=.32;roundRect(px+2,top+2,Math.max(0,pw-4),4,2,colors.white);
    ctx.globalAlpha=.12;roundRect(px,top+LH-4,pw,4,2,colors.ink);ctx.globalAlpha=1;
  }
  function scenery() {
    ctx.fillStyle=colors.sky;ctx.fillRect(0,0,420,520);
    var drift=camera*.25;
    ellipse(350,170+(drift%600),24,24,colors.sun);
    cloud(70,((180+drift)%640)-60,.85);cloud(330,((360+drift*.8)%640)-60,.9);cloud(200,((560+drift*.6)%640)-60,.7);
    var ground=GROUND+camera;
    if(ground<520) {
      ellipse(60,ground+18,170,34,colors.grassLight);ellipse(360,ground+14,190,40,colors.grassLight);
      ctx.fillStyle=colors.ground;ctx.fillRect(0,ground+6,420,520-ground);
      ctx.fillStyle=colors.grass;ctx.fillRect(0,ground,420,8);
    }
  }
  function tower() {
    var top=state.stack.length-1;
    var first=Math.max(0,Math.floor((camera-(520-GROUND))/LH)-1);
    for(var i=first;i<=top;i+=1) {
      var y=layerTop(i);
      if(i===top&&fall)y-=HOVER*(1-fall.t*fall.t);
      if(y>520||y<HUD-LH-HOVER)continue;
      block(state.stack[i].x,state.stack[i].width,y,layerColor(i));
    }
    if(state.moving&&mode!=='ended') {
      block(state.moving.x,state.moving.width,layerTop(top+1)-HOVER,layerColor(top+1));
    }
    for(var p=0;p<pieces.length;p+=1) {
      var piece=pieces[p];
      // A trimmed piece rides the falling box down, then breaks away.
      var lift=piece.wait>0?HOVER*(1-Math.pow(1-piece.wait/7,2)):0;
      ctx.save();ctx.globalAlpha=Math.max(0,1-piece.age/70);
      ctx.translate(sx(piece.x+piece.w/2),piece.y+camera+LH/2-lift);ctx.rotate(piece.rot);
      roundRect(-piece.w*SCALE/2,-LH/2,piece.w*SCALE,LH,4,piece.color);ctx.restore();
    }
  }
  function cat() {
    if(imagesLoaded!==2)return;
    var top=state.stack[state.stack.length-1];
    var x=sx(top.x+top.width/2),feet=layerTop(state.stack.length-1),jumping=false;
    if(hop) {
      var e=1-Math.pow(1-hop.t,2);
      x=sx(hop.fromX+(hop.toX-hop.fromX)*e);
      feet=hop.fromY+camera+(feet-(hop.fromY+camera))*e-Math.sin(hop.t*Math.PI)*28;
      jumping=hop.t<1;
    }
    var image=jumping?jumpImage:idleImage;
    var width=66,height=width*image.naturalHeight/image.naturalWidth;
    ctx.save();ctx.translate(x,feet);
    if(mode==='ended'&&state.endReason==='miss')ctx.rotate(.12);
    ctx.drawImage(image,-width/2,-height*265/image.naturalHeight,width,height);ctx.restore();
  }
  function sparkle(x,y,r,color) {
    ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.3,y-r*.3);ctx.lineTo(x+r,y);ctx.lineTo(x+r*.3,y+r*.3);
    ctx.lineTo(x,y+r);ctx.lineTo(x-r*.3,y+r*.3);ctx.lineTo(x-r,y);ctx.lineTo(x-r*.3,y-r*.3);ctx.closePath();
    ctx.fillStyle=color;ctx.fill();
  }
  function perfectFlash() {
    if(!flash)return;
    var k=flash.t/45,alpha=Math.max(0,1-k);
    ctx.globalAlpha=alpha;
    var y=flash.y+camera+LH/2;
    for(var i=0;i<6;i+=1) {
      var a=i*Math.PI/3+.4,dist=18+k*46;
      sparkle(flash.x+Math.cos(a)*(flash.w/2+dist*.6),y+Math.sin(a)*dist*.5,5*(1-k)+2,colors.sun);
    }
    var size=20+Math.min(1,flash.t/6)*6;
    text(copy.perfect,210,HUD+22-k*8,size,colors.primaryDark,'center');
    ctx.globalAlpha=1;
  }
  function pill(label) {
    roundRect(100,238,220,60,23,colors.primaryDark);
    text(label,210,269,24,colors.white,'center');
  }
  function syncButtons() {
    startButton.hidden=mode!=='ready'||!hostActive;
    pauseButton.hidden=mode!=='playing';resumeButton.hidden=mode!=='paused'||!hostActive;
  }
  function render() {
    if(destroyed)return;
    scenery();tower();cat();
    // The opaque header keeps the tower out of the score area.
    ctx.fillStyle=colors.sky;ctx.fillRect(0,0,420,HUD);
    text(config.practice?copy.titlePractice:copy.title,24,28,17,colors.primaryDark);
    if(mode==='playing'||mode==='paused'||mode==='ended') {
      text(fmt(copy.points,{score:state.score}),24,63,29,colors.ink);
      text(fmt(copy.layers,{layers:state.layers}),24,94,15,colors.muted);
      if(state.streak>=2)text(fmt(copy.combo,{n:state.streak}),396,94,15,colors.primaryDark,'right');
    }
    perfectFlash();
    if(mode==='playing') {
      roundRect(350,18,52,52,18,colors.paper);
      roundRect(368,33,5,21,2,colors.primaryDark);roundRect(380,33,5,21,2,colors.primaryDark);
    }
    if(mode==='ready') {
      roundRect(60,174,300,146,26,colors.paper);
      text(copy.hint,210,206,20,colors.muted,'center');
      pill(copy.start);
    }
    if(mode==='paused') {
      roundRect(60,158,300,162,26,colors.paper);
      text(copy.paused,210,198,26,colors.ink,'center');
      if(hostActive)pill(copy.resume);
    }
    if(mode==='ended') {
      roundRect(60,148,300,166,26,colors.paper);
      text(copy.gameOver,210,183,23,colors.ink,'center');
      text(fmt(copy.points,{score:state.score}),210,231,38,colors.primaryDark,'center');
      var reason=state.endReason==='miss'?copy.miss:state.endReason==='limit'?copy.timeUp:'';
      text(fmt(copy.layers,{layers:state.layers})+(reason?' · '+reason:''),210,280,16,colors.muted,'center');
    }
    if(mode==='loading'||mode==='error') {
      roundRect(24,160,372,70,24,colors.paper);
      text(mode==='loading'?copy.loading:copy.loadFailed,210,195,22,colors.ink,'center');
    }
    syncButtons();
  }
  // Effects advance per tick: frozen while paused, and only finishing their fall after the end.
  function advanceFx(ticks) {
    var target=Math.max(0,(state.stack.length)*LH-(GROUND-TOP_LINE));
    camera+=(target-camera)*Math.min(1,.16*ticks);
    if(Math.abs(target-camera)<.2)camera=target;
    if(fall){fall.t=Math.min(1,fall.t+ticks/7);if(fall.t>=1)fall=null;}
    if(hop){hop.t=Math.min(1,hop.t+ticks/14);if(hop.t>=1)hop=null;}
    if(flash){flash.t+=ticks;if(flash.t>=45)flash=null;}
    for(var i=pieces.length-1;i>=0;i-=1) {
      var p=pieces[i];
      if(p.wait>0){p.wait=Math.max(0,p.wait-ticks);continue;}
      p.vy+=.55*ticks;p.y+=p.vy*ticks;p.rot+=p.spin*ticks;p.age+=ticks;
      if(p.age>70||p.y+camera>560)pieces.splice(i,1);
    }
  }
  function fxActive(){return !!(fall||hop||flash||pieces.length)||Math.abs(camera-Math.max(0,state.stack.length*LH-(GROUND-TOP_LINE)))>.2;}
  function onDrop(old) {
    var oldTop=old.stack.length-1;
    if(state.ended&&state.endReason==='miss') {
      // A full miss falls from where the box was hovering.
      pieces.push({x:old.moving.x,w:old.moving.width,y:layerTop(oldTop+1)-HOVER-camera,vy:0,rot:0,
        spin:(old.moving.x<old.stack[oldTop].x?-1:1)*.03,age:0,wait:0,color:layerColor(oldTop+1)});
      post('fx',{kind:'over'});
      return;
    }
    var top=state.stack.length-1,placed=state.stack[top],prev=old.stack[oldTop];
    fall={t:0};
    hop={t:0,fromX:prev.x+prev.width/2,toX:placed.x+placed.width/2,fromY:layerTop(oldTop)-camera};
    if(state.lastDrop&&state.lastDrop.cut) {
      var cut=state.lastDrop.cut;
      pieces.push({x:cut.x,w:cut.width,y:layerTop(top)-camera,vy:-1.5,rot:0,
        spin:(cut.x<placed.x?-1:1)*.04,age:0,wait:7,color:layerColor(top)});
    }
    if(state.lastDrop&&state.lastDrop.perfect) {
      flash={t:0,x:sx(placed.x+placed.width/2),w:placed.width*SCALE,y:layerTop(top)-camera};
    }
    var kind=state.layers%10===0?'milestone':state.lastDrop&&state.lastDrop.perfect?'merge':'step';
    post('fx',{kind:kind});
  }
  function finish() {
    if(finished)return;finished=true;mode='ended';pendingDrop=false;
    render();post('finish',{result:{ticks:state.tick,dropTicks:state.dropTicks.slice()}});
  }
  function step() {
    if(mode!=='playing'||!hostActive||destroyed)return;
    var old=state;state=engine.step(pendingDrop);pendingDrop=false;
    if(state.dropTicks.length!==old.dropTicks.length)onDrop(old);
    advanceFx(1);
    if(state.ended)finish();
  }
  function begin() {
    if(!hostActive||destroyed||mode!=='ready')return;
    mode='playing';lastTime=0;accumulator=0;canvas.focus();render();
  }
  function pause() {
    if(mode!=='playing')return;
    mode='paused';pendingDrop=false;accumulator=0;lastTime=0;
    post('pause',{paused:true});render();
  }
  function resume() {
    if(mode!=='paused'||!hostActive||document.hidden)return;
    mode='playing';lastTime=0;accumulator=0;canvas.focus();post('pause',{paused:false});render();
  }
  function press() {
    if(mode==='ready'){begin();return;}
    if(mode==='paused'){resume();return;}
    if(mode==='playing'&&hostActive&&!destroyed)pendingDrop=true;
  }
  function onPointer(event){event.preventDefault();press();}
  function onKey(event) {
    if((event.code==='Space'||event.code==='Enter')&&event.target instanceof Element&&event.target.closest('button'))return;
    if(event.code==='Space'||event.code==='ArrowDown'||event.code==='Enter') {
      event.preventDefault();if(!event.repeat)press();
    } else if(event.code==='KeyP'||event.code==='Escape') {
      event.preventDefault();if(event.repeat)return;
      if(mode==='playing')pause();else if(mode==='paused')resume();
    } else if(event.code==='KeyF') {
      if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(function(){});
      else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(function(){});
    }
  }
  function onVisibility(){if(document.hidden)pause();}
  function onMessage(event) {
    if(event.source!==window.parent||!event.data||event.data.channelId!==config.channelId)return;
    if(event.data.type==='active'&&typeof event.data.active==='boolean')window.setTowerActive(event.data.active);
    if(event.data.type==='destroy')window.destroyTower();
  }
  function loop(now) {
    if(destroyed)return;frameId=requestAnimationFrame(loop);
    if(manualClock){lastTime=0;return;}
    if(mode==='ended') {
      // Let the last pieces finish falling; the game state is already final.
      if(!lastTime){lastTime=now;return;}
      var dt=Math.min(100,now-lastTime);lastTime=now;
      if(fxActive()){advanceFx(dt*60/1000);render();}
      return;
    }
    if(mode!=='playing'||!hostActive){lastTime=0;return;}
    if(!lastTime){lastTime=now;return;}
    var elapsed=now-lastTime;lastTime=now;if(elapsed>500){pause();return;}
    accumulator+=elapsed;
    while(accumulator+.00001>=1000/60&&mode==='playing'){step();accumulator-=1000/60;}
    render();
  }
  window.setTowerActive=function(active){hostActive=active===true;if(!hostActive)pause();render();};
  window.render_game_to_text=function(){return JSON.stringify({
    gameCode:'cat-tower',rulesVersion:config.rulesVersion,mode:mode,
    coordinates:'420x520; origin top-left; stage x 0..1000 maps to 18+x*0.384; layer i top y=490-(i+1)*24+camera',
    tick:state.tick,score:state.score,layers:state.layers,streak:state.streak,speed:state.speed,
    active:hostActive,practice:config.practice,manualTime:config.manualTime,character:'rougether-cat',
    top:state.stack[state.stack.length-1],moving:state.moving,lastDrop:state.lastDrop,camera:Math.round(camera),
    dropCount:state.dropTicks.length,endReason:state.endReason
  });};
  if(config.manualTime)window.advanceTime=function(ms){
    if(!Number.isFinite(ms)||ms<0||ms>300000)return;
    manualClock=true;lastTime=0;manualRemainder+=ms*60/1000;
    var ticks=Math.floor(manualRemainder+.00001);manualRemainder-=ticks;
    for(var i=0;i<ticks&&mode==='playing';i+=1)step();
    if(mode==='ended')advanceFx(ticks);
    render();
  };else delete window.advanceTime;
  window.destroyTower=function(){
    destroyed=true;hostActive=false;cancelAnimationFrame(frameId);
    canvas.removeEventListener('pointerdown',onPointer);
    window.removeEventListener('keydown',onKey);window.removeEventListener('message',onMessage);
    document.removeEventListener('visibilitychange',onVisibility);
    startButton.removeEventListener('click',begin);pauseButton.removeEventListener('click',pause);
    resumeButton.removeEventListener('click',resume);
  };
  canvas.addEventListener('pointerdown',onPointer);
  window.addEventListener('keydown',onKey);window.addEventListener('message',onMessage);
  document.addEventListener('visibilitychange',onVisibility);
  startButton.addEventListener('click',begin);pauseButton.addEventListener('click',pause);
  resumeButton.addEventListener('click',resume);
  function onImageLoaded(){imagesLoaded+=1;if(imagesLoaded===2&&!destroyed){mode='ready';render();}}
  function onImageError(){mode='error';render();}
  idleImage.onload=onImageLoaded;jumpImage.onload=onImageLoaded;idleImage.onerror=onImageError;jumpImage.onerror=onImageError;
  idleImage.src=config.idleImage;jumpImage.src=config.jumpImage;
  camera=Math.max(0,state.stack.length*LH-(GROUND-TOP_LINE));
  render();frameId=requestAnimationFrame(loop);post('ready');
}`;
