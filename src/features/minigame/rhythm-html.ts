import type { SemanticColors } from '@/constants/theme';
import { Spacing, Themes } from '@/constants/theme';
import { RUNNER_CAT_IDLE, RUNNER_CAT_JUMP } from '@/features/minigame/runner-character';
import { RHYTHM_ENGINE_SOURCE } from '@/features/minigame/rhythm-model';
import chartData from '@/features/minigame/rhythm-chart.json';
import { RHYTHM_MUSIC_BASE64 } from '@/features/minigame/rhythm-music';
import { i18n } from '@/i18n';
import { escapeHtml } from '@/features/minigame/minigame-copy';

export type RhythmHtmlOptions = {
  channelId: string;
  colors?: SemanticColors;
  allowManualTime?: boolean;
};

export function createRhythmHtml(options: RhythmHtmlOptions) {
  const config = JSON.stringify({
    channelId: options.channelId,
    chart: chartData,
    music: RHYTHM_MUSIC_BASE64,
    manual: options.allowManualTime === true,
    colors: options.colors ?? Themes.cozy,
    idle: RUNNER_CAT_IDLE,
    jump: RUNNER_CAT_JUMP,
    copy: i18n.t('minigame.rhythm', { returnObjects: true }),
  }).replace(/</g, '\\u003c');
  const source = RHYTHM_ENGINE_SOURCE;
  return `<!doctype html><html lang="${i18n.language.startsWith('ko') ? 'ko' : 'en'}"><head><meta charset="utf-8"><title>${escapeHtml(i18n.t('minigame.rhythm.name'))} · Rougether</title>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${(options.colors ?? Themes.cozy).screen};font-family:system-ui,sans-serif;touch-action:manipulation;overscroll-behavior:none;user-select:none}
body{display:flex;align-items:center;justify-content:center}main{width:min(100vw,calc(100dvh * 420 / 580),580px);aspect-ratio:420 / 580;position:relative;margin:auto}canvas{width:100%;height:100%;display:block;outline:none;touch-action:none}
button{position:absolute;background:transparent;border:0;color:transparent;cursor:pointer;min-height:44px;min-width:44px;touch-action:manipulation}button:focus-visible{outline:3px solid ${(options.colors ?? Themes.cozy).primaryText};border-radius:20px}
#start,#resume,#again{left:14%;bottom:11%;width:72%;height:9%}#tap{left:9%;bottom:9%;width:82%;height:16%}#pause{right:3%;top:2%;width:17%;height:8%}#calibrate{left:8%;bottom:2%;width:44%;height:8%}#settings{right:8%;bottom:2%;width:40%;height:8%}
[hidden]{display:none!important}#panel{position:absolute;inset:18% 7%;padding:${Spacing.four}px;border-radius:24px;background:${(options.colors ?? Themes.cozy).surface};color:${(options.colors ?? Themes.cozy).text};box-shadow:0 8px 40px #0002}#panel button{position:static;color:inherit;border:1px solid ${(options.colors ?? Themes.cozy).border};border-radius:16px;width:100%;margin-top:16px}#panel input{width:100%;accent-color:${(options.colors ?? Themes.cozy).primary}}label{display:block;margin:18px 0}p{line-height:1.6}#announcer{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
</style></head><body><main><canvas id="game" width="420" height="580" tabindex="0"></canvas>
<button id="start"></button><button id="tap" hidden></button><button id="pause" hidden></button><button id="resume" hidden></button><button id="again" hidden></button><button id="calibrate"></button><button id="settings"></button>
<section id="panel" hidden><h2 id="settings-title"></h2><label id="volume-label"><input id="volume" type="range" min="0" max="100" value="70"></label><label id="offset-label"><input id="offset" type="range" min="-250" max="250" step="5" value="0"></label><output id="offset-value"></output><p id="settings-help"></p><button id="close"></button></section><div id="announcer" aria-live="polite"></div>
</main><script>${source}\n(${RHYTHM_BROWSER_SOURCE})(${config});</script></body></html>`;
}

const RHYTHM_BROWSER_SOURCE = String.raw`function runRhythm(config) {
  'use strict';
  const $ = id => document.getElementById(id), canvas = $('game'), ctx = canvas.getContext('2d');
  const c = config.colors, copy = config.copy, chart = config.chart;
  let judge = createRhythmJudge(chart), mode = 'loading', active = true, destroyed = false;
  let ac, buffer, source, master, startAt = 0, position = 0, virtual = null, frameId;
  let nextCue = 0, queue = [], nodes = [], inputDown = false, lastFeedback = null, feedbackAt = -10;
  let outputClock = 'fallback', offsetMs = 0, volume = 0.7, calibration = [], calibrationStart = 0, calNext = 0;
  let callbackSent = false, loadSerial = 0, savedMode = 'title';
  const idle = new Image(), jump = new Image();
  idle.src = config.idle; jump.src = config.jump;
  try { const saved = JSON.parse(localStorage.getItem('rougether-rhythm-v1') || '{}'); if (Number.isFinite(saved.offset)) offsetMs = Math.max(-250, Math.min(250, saved.offset)); if (Number.isFinite(saved.volume)) volume = Math.max(0, Math.min(1, saved.volume)); } catch {}
  const send = message => { const envelope = { channelId: config.channelId, ...message }; if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(envelope)); else if (window.parent !== window) window.parent.postMessage(envelope, '*'); };
  for (const name of ['start','tap','pause','resume','again','calibrate','settings','close']) { $(name).textContent = copy[name]; $(name).setAttribute('aria-label', copy[name]); }
  canvas.setAttribute('aria-label', copy.canvas);
  $('settings-title').textContent = copy.settings;
  $('volume-label').prepend(copy.volume); $('offset-label').prepend(copy.offset); $('settings-help').textContent = copy.settingsHelp;
  $('volume').value = volume * 100; $('offset').value = offsetMs; $('offset-value').textContent = offsetMs + ' ms';
  const save = () => { try { localStorage.setItem('rougether-rhythm-v1', JSON.stringify({ offset: offsetMs, volume })); } catch {} };
  function outputTime(perf) {
    let stamp;
    try { stamp = ac.getOutputTimestamp && ac.getOutputTimestamp(); } catch {}
    outputClock = stamp && stamp.contextTime > 0 && stamp.performanceTime > 0 ? 'output-timestamp' : 'latency-fallback';
    return audibleContextTime(ac.currentTime, stamp, perf ?? performance.now(), ac.outputLatency, ac.baseLatency);
  }
  const raw = perf => mode === 'result' ? chart.duration : virtual !== null ? virtual : !ac || mode !== 'running' ? position : Math.max(0, position + outputTime(perf) - startAt);
  const time = perf => Math.max(0, raw(perf) - offsetMs / 1000);
  function refresh() {
    for (const id of ['start','tap','pause','resume','again','calibrate','settings']) $(id).hidden = true;
    if (mode === 'title' || mode === 'error') { $('start').hidden = false; $('calibrate').hidden = false; $('settings').hidden = false; }
    if (mode === 'running') { $('tap').hidden = false; $('pause').hidden = false; }
    if (mode === 'paused') $('resume').hidden = false;
    if (mode === 'result') { $('again').hidden = false; $('settings').hidden = false; $('calibrate').hidden = false; }
    if (mode === 'calibration') { $('tap').hidden = false; $('pause').hidden = false; }
  }
  async function initAudio() {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) throw new Error('audio unavailable');
    if (!ac) { ac = new Constructor({ latencyHint: 'interactive' }); master = ac.createGain(); master.gain.value = volume; master.connect(ac.destination); }
    await ac.resume();
    if (!buffer) { const bytes = Uint8Array.from(atob(config.music), ch => ch.charCodeAt(0)); buffer = await ac.decodeAudioData(bytes.buffer); }
  }
  function stop() {
    if (source) { try { source.stop(); source.disconnect(); } catch {} source = null; }
    for (const node of nodes) { try { node.stop(); node.disconnect(); } catch {} } nodes = [];
  }
  function tone(when, pitch, length, gain) {
    if (!ac || destroyed) return;
    const oscillator = ac.createOscillator(), amp = ac.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = pitch;
    amp.gain.setValueAtTime(0, when); amp.gain.linearRampToValueAtTime(gain, when + .002); amp.gain.exponentialRampToValueAtTime(.0001, when + length);
    oscillator.connect(amp); amp.connect(master); oscillator.start(when); oscillator.stop(when + length + .02);
    nodes.push(oscillator); oscillator.onended = () => { oscillator.disconnect(); amp.disconnect(); nodes = nodes.filter(n => n !== oscillator); };
  }
  function transport(at) {
    stop(); position = at; startAt = ac.currentTime + .12;
    source = ac.createBufferSource(); source.buffer = buffer; source.connect(master); source.start(startAt, at);
    queue = [];
    for (const n of chart.notes) {
      const cues = n.kind === 'rush' ? [n.beats[4]] : n.beats.slice(0, 6);
      cues.forEach((t, i) => { if (t >= at && !n.hidden.includes(i)) queue.push({ t, f: n.kind === 'rush' ? 784 : 523 + i * 26 }); });
      if (n.hold && n.target + n.hold >= at) queue.push({ t: n.target + n.hold, f: 1047 });
    }
    queue.sort((a,b) => a.t - b.t); nextCue = 0;
  }
  function schedule() {
    if (!ac || virtual !== null || destroyed) return;
    if (mode === 'running') {
      // Scheduling stays in the graph clock, separate from audible display/input.
      const graphTime = position + ac.currentTime - startAt;
      while (nextCue < queue.length && queue[nextCue].t < graphTime + .2) {
        const cue = queue[nextCue++], at = startAt + cue.t - position;
        if (at >= ac.currentTime) tone(at, cue.f, .095, .22);
      }
    } else if (mode === 'calibration') {
      while (calNext < 40 && calibrationStart + calNext * .5 < ac.currentTime + .2) { const at = calibrationStart + calNext++ * .5; if (at >= ac.currentTime) tone(at, 880, .1, .35); }
      if (ac.currentTime > calibrationStart + 20) finishCalibration();
    }
  }
  const interval = setInterval(schedule, 25);
  async function begin(reset) {
    if (!active || destroyed || mode === 'loading') return;
    const serial = ++loadSerial; mode = 'loading'; refresh();
    try {
      await initAudio();
      if (serial !== loadSerial || destroyed || !active) return;
      if (reset) { judge = createRhythmJudge(chart); position = 0; callbackSent = false; lastFeedback = null; virtual = null; }
      transport(position); mode = 'running'; inputDown = false; refresh(); canvas.focus(); schedule();
    } catch { mode = 'error'; $('announcer').textContent = copy.error; refresh(); }
  }
  function pause() {
    if (mode === 'calibration') { finishCalibration(); return; }
    if (mode !== 'running' && mode !== 'loading') return;
    const at = raw(); ++loadSerial; stop(); position = at; mode = 'paused'; judge.suspend(); inputDown = false; refresh(); canvas.focus(); send({ type: 'pause', paused: true });
  }
  function eventPerf(event) { const t = event && event.timeStamp; return Number.isFinite(t) && Math.abs(performance.now() - t) < 1000 ? t : performance.now(); }
  function showFeedback(value) {
    if (!value) return; lastFeedback = value; feedbackAt = raw(); $('announcer').textContent = copy[value.grade] || copy.hold;
    if (value.grade === 'perfect') send({type:'fx',kind:'step'});
    if (ac && virtual === null && value.grade === 'perfect') tone(ac.currentTime + .002, 1175, .14, .18);
  }
  function press(event) {
    if (mode === 'calibration') {
      if (inputDown) return; inputDown = true;
      const t = outputTime(eventPerf(event)) - calibrationStart;
      if (t < .75) return;
      const error = (t - Math.round(t / .5) * .5) * 1000;
      if (Math.abs(error) < 220) calibration.push(error);
      if (calibration.length >= 10) finishCalibration(); return;
    }
    if (mode !== 'running' || !active || inputDown) return;
    inputDown = true; showFeedback(judge.press(time(eventPerf(event))));
  }
  function release(event) { inputDown = false; if (mode === 'running') showFeedback(judge.release(time(eventPerf(event)))); }
  function finishCalibration() {
    stop(); if (calibration.length >= 6) { const values = [...calibration.slice(2)].sort((a,b) => a-b); offsetMs = Math.round(values[Math.floor(values.length / 2)] / 5) * 5; offsetMs = Math.max(-250, Math.min(250, offsetMs)); save(); }
    mode = 'title'; position = 0; refresh(); $('offset').value = offsetMs; $('offset-value').textContent = offsetMs + ' ms';
  }
  $('calibrate').onclick = async () => { if (!active || destroyed) return; const serial = ++loadSerial; mode = 'loading'; refresh(); try { await initAudio(); if (!active || destroyed || serial !== loadSerial) return; stop(); calibration = []; calNext = 0; calibrationStart = ac.currentTime + .15; mode = 'calibration'; refresh(); canvas.focus(); schedule(); } catch { mode = 'error'; refresh(); } };
  $('start').onclick = () => begin(true); $('again').onclick = () => begin(true);
  $('resume').onclick = () => { send({ type: 'pause', paused: false }); begin(false); };
  $('pause').onclick = pause;
  $('settings').onclick = () => { savedMode = mode; $('panel').hidden = false; };
  $('close').onclick = () => { $('panel').hidden = true; mode = savedMode; };
  $('offset').oninput = e => { offsetMs = Number(e.target.value); $('offset-value').textContent = offsetMs + ' ms'; save(); };
  $('volume').oninput = e => { volume = Number(e.target.value) / 100; if (master) master.gain.value = volume; save(); };
  $('tap').onpointerdown = e => { e.preventDefault(); $('tap').setPointerCapture(e.pointerId); press(e); };
  $('tap').onpointerup = e => { e.preventDefault(); release(e); };
  $('tap').onpointercancel = pause;
  document.addEventListener('keydown', e => {
    if (['INPUT','BUTTON'].includes(document.activeElement.tagName) && document.activeElement !== $('tap')) return;
    if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; if (mode === 'title' || mode === 'result') begin(true); else if (mode === 'paused') begin(false); else press(e); }
    if (e.code === 'Escape' || e.code === 'KeyP') pause();
    if (e.code === 'KeyF') { if (document.fullscreenElement) document.exitFullscreen(); else canvas.parentElement.requestFullscreen && canvas.parentElement.requestFullscreen(); }
  });
  document.addEventListener('keyup', e => { if (e.code === 'Space') { e.preventDefault(); release(e); } });
  window.addEventListener('blur', pause); document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.setRhythmActive = enabled => { active = enabled === true; if (!active) pause(); };
  window.destroyRhythm = () => { destroyed = true; ++loadSerial; stop(); clearInterval(interval); cancelAnimationFrame(frameId); if (ac) ac.close(); };
  window.addEventListener('message', e => { if (e.source !== window.parent || !e.data || e.data.channelId !== config.channelId) return; if (e.data.type === 'active') window.setRhythmActive(e.data.active); if (e.data.type === 'destroy') window.destroyRhythm(); });
  function rounded(x,y,w,h,r,fill,stroke) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }
  function text(value,x,y,size,color,align) { ctx.font = size + 'px system-ui,sans-serif'; ctx.fillStyle = color || c.text; ctx.textAlign = align || 'center'; ctx.fillText(value,x,y); }
  function circle(x,y,r,color) { ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); }
  function room(t) {
    const phase = Math.min(3, Math.floor(Math.max(0,t-2) / 16));
    rounded(22,80,376,256,28,c.surfaceMuted);
    ctx.save(); ctx.beginPath(); ctx.roundRect(22,80,376,256,28); ctx.clip();
    ctx.fillStyle=c.surface; ctx.fillRect(22,80,376,182);
    for(let x=36;x<398;x+=18){ctx.fillStyle=c.border;ctx.globalAlpha=.22;ctx.fillRect(x,80,1,182);} ctx.globalAlpha=1;
    rounded(247,105,117,122,18,c.primarySoft,c.border);
    circle(phase===3?330:276,130,13,c.warning); ctx.strokeStyle=c.surface;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(306,106);ctx.lineTo(306,226);ctx.moveTo(249,166);ctx.lineTo(362,166);ctx.stroke();
    ctx.fillStyle=c.border;ctx.fillRect(247,223,118,7);
    // Book shelf, sofa, rug and watering plant retain the app's paper-and-ink palette.
    rounded(48,133,122,9,3,c.border); for(let i=0;i<6;i++)rounded(57+i*14,105+(i%2)*6,10,29-(i%2)*6,2,i%2?c.primary:c.primarySoft,c.border);
    rounded(44,229,134,52,16,c.primarySoft,c.border);rounded(54,216,112,42,13,c.primarySoft,c.border);rounded(90,221,38,32,10,c.surface,c.border);
    rounded(39,265,13,27,4,c.border);rounded(169,265,8,27,3,c.border);
    ctx.save();ctx.translate(216,300);ctx.scale(1,.35);circle(0,0,102,c.surface);ctx.restore();
    const bounce=0;
    const successful = lastFeedback && ['perfect','good','hold'].includes(lastFeedback.grade) && t-feedbackAt<.3;
    const image=successful?jump:idle;
    if(image.complete && image.naturalWidth)ctx.drawImage(image,144,179-bounce-(successful?9:0),140,122);
    else { circle(210,236,30,c.primarySoft); text('♪',210,245,24,c.primaryText); }
    rounded(308,277,34,33,8,c.primary,c.primaryText);ctx.strokeStyle=c.primaryText;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(325,284);ctx.lineTo(325,242);ctx.stroke();
    for(let i=0;i<4;i++){ctx.save();ctx.translate(325,269-i*8);ctx.rotate(i%2?.8:-.8);ctx.scale(1,.4);circle(i%2?10:-10,0,13,c.primary);ctx.restore();}
    if(judge.state().perfect>3){circle(325,239,9,c.primarySoft);circle(325,239,4,c.primaryText);}
    for(let x=25;x<398;x+=46){ctx.strokeStyle=c.border;ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(x,306);ctx.lineTo(x+30,310);ctx.stroke();}ctx.globalAlpha=1;
    ctx.restore();
    if(successful){for(let i=0;i<7;i++){const a=i*Math.PI*2/7;circle(213+Math.cos(a)*64,238+Math.sin(a)*51,2+(i%2),c.primary);}}
    return phase;
  }
  function draw() {
    const rect=canvas.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
    if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
    ctx.setTransform(canvas.width/420,0,0,canvas.height/580,0,0);ctx.fillStyle=c.screen;ctx.fillRect(0,0,420,580);
    const t=mode==='title'||mode==='loading'||mode==='error'?0:raw(), s=judge.state();
    text(copy.name,28,39,21,c.text,'left');
    if(mode==='running'||mode==='paused'){text(s.score.toLocaleString(),333,35,18,c.primaryText);text(copy.pause,376,59,12,c.textMuted);}
    const phase=room(t);
    const next=chart.notes.find(n=>['pending','holding'].includes(s.status[n.id]));
    const level=next?.level||4;
    if(mode==='running' || mode==='paused') {
      text(copy.phases[level-1],210,109,12,c.primaryText);
      rounded(22,347,376,100,22,c.surface,c.border);
      text(copy.stageHints[level-1],210,386,17,c.primaryText);
      const prompt=s.held?copy.hold:copy.listen;
      text(prompt,210,423,13,c.textMuted);
      if(lastFeedback && t-feedbackAt<.9){text(copy[lastFeedback.grade]||copy.hold,210,474,18,c.primaryText);text(lastFeedback.errorMs?((lastFeedback.errorMs>0?'+':'')+lastFeedback.errorMs+' ms'):'',210,495,11,c.textMuted);}
      else text(s.combo?copy.combo.replace('{n}',String(s.combo)):copy.listen,210,478,15,c.textMuted);
      rounded(36,502,348,51,24,inputDown?c.primaryActive:c.primary);text(s.held?copy.hold:copy.tap,210,534,18,c.onPrimary);
      rounded(22,566,376,4,2,c.border);rounded(22,566,376*Math.min(1,t/chart.duration),4,2,c.primary);
      if(mode==='paused'){rounded(28,170,364,353,25,c.surface,c.border);text(copy.paused,210,306,24);text(copy.pauseHelp,210,342,13,c.textMuted);rounded(59,464,302,50,24,c.primary);text(copy.resume,210,496,17,c.onPrimary);}
    } else if(mode==='calibration') {
      const calTime=ac?outputTime()-calibrationStart:0, pulse=Math.max(0,1-((calTime+.5)% .5)/.15);
      circle(210,391,35+pulse*9,c.primarySoft);text(String(calibration.length)+'/10',210,398,20,c.primaryText);text(copy.calHelp,210,451,14,c.textMuted);rounded(36,502,348,51,24,c.primary);text(copy.tap,210,534,18,c.onPrimary);
    } else {
      if(mode==='result') { text(copy.complete,210,375,22);text(s.score.toLocaleString()+' / '+(chart.notes.length*1000).toLocaleString(),210,414,23,c.primaryText);text(copy.summary.replace('{perfect}',String(s.perfect)).replace('{good}',String(s.good)).replace('{miss}',String(s.miss)),210,443,12,c.textMuted); }
      else {text(mode==='loading'?copy.loading:mode==='error'?copy.error:copy.tagline,210,375,21);text(copy.instructions,210,407,14,c.textMuted);text(copy.subtitle,210,436,12,c.textMuted);}
      rounded(59,464,302,50,24,c.primary);text(mode==='result'?copy.again:copy.start,210,496,17,c.onPrimary);text(copy.calibrate,120,550,12,c.textMuted);text(copy.settings,310,550,12,c.textMuted);
    }
  }
  function update() {
    if(mode==='running') {
      const before=judge.state().miss; judge.update(time()); const s=judge.state(); if(s.miss>before)showFeedback(s.feedback);
      if(raw()>=chart.duration+.25){position=chart.duration;mode='result';stop();refresh();if(!callbackSent){callbackSent=true;send({type:'finish',result:judge.result()});}}
    }
  }
  function frame() { if(destroyed)return;update();draw();frameId=requestAnimationFrame(frame); }
  window.get_rhythm_audio_diagnostics = () => ({ decodedDuration:buffer?.duration, sampleRate:ac?.sampleRate, baseLatency:ac?.baseLatency, outputLatency:ac?.outputLatency, source:'Suno 8b361e0f-97f5-49c2-9249-9037e5e0a3da' });
  window.render_game_to_text = () => JSON.stringify({ mode, songTime:raw(), bpm:chart.bpm, outputClock, offsetMs, calibrationSamples:calibration.length, calibrationTime:mode==='calibration'&&ac?outputTime()-calibrationStart:null, ...judge.state(), next:chart.notes.find(n=>['pending','holding'].includes(judge.state().status[n.id])), visualBeatGuide:false, level:chart.notes.find(n=>['pending','holding'].includes(judge.state().status[n.id]))?.level||4, coordinates:'420x580, origin top-left' });
  if(config.manual)window.advanceTime=ms=>{if(mode!=='running')return;if(virtual===null){virtual=raw();stop();}virtual+=Math.max(0,ms)/1000;update();draw();};
  Promise.all([idle.decode(),jump.decode()]).then(()=>{if(!destroyed){mode='title';refresh();send({type:'ready'});}}).catch(()=>{mode='error';refresh();send({type:'error'});});
  refresh(); frame();
}`;
