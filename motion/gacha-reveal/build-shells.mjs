import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { format, resolveConfig } from 'prettier';

const project = dirname(fileURLToPath(import.meta.url));
const formatterOptions = (await resolveConfig(join(project, 'index.html'))) ?? {};
export const profiles = {
  common: {
    duration: 2.4,
    revealAt: 1.1,
    strength: 0.48,
    zoom: 1.035,
    dip: 0.18,
    particles: 8,
    music: 0.46,
    whoosh: 0.32,
  },
  rare: {
    duration: 2.7,
    revealAt: 1.3,
    strength: 0.74,
    zoom: 1.068,
    dip: 0.27,
    particles: 14,
    music: 0.56,
    whoosh: 0.43,
  },
  legendary: {
    duration: 2.9,
    revealAt: 1.55,
    strength: 1,
    zoom: 1.11,
    dip: 0.36,
    particles: 22,
    music: 0.64,
    whoosh: 0.52,
  },
};

function envelope(points) {
  return JSON.stringify({ version: 1, lanes: [{ target: 'volume', points }] }).replaceAll(
    '"',
    '&quot;',
  );
}

function shell(tier, p) {
  const R = p.revealAt;
  const D = p.duration;
  const hold = Number((R + 0.62).toFixed(2));
  const musicEnd = Number(Math.min(2.5, D - 0.08).toFixed(2));
  const track = { common: 1, rare: 3, legendary: 5 }[tier];
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1080, height=2340">
  <title>Rougether ${tier} reveal shell</title>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1080px; height: 2340px; overflow: hidden; background: #765c3e; }
    #stage { position: relative; width: 1080px; height: 2340px; overflow: hidden; background: #765c3e; }
    .clip { position: absolute; inset: 0; width: 1080px; height: 2340px; overflow: hidden; }
    #camera { position: absolute; inset: 0; width: 1080px; height: 2340px; transform-origin: 50% 50%; }
    #stage-art { position: absolute; inset: 0; width: 1080px; height: 2340px; object-fit: cover; }
    #stage-shadow { position: absolute; inset: 0; background: #302319; pointer-events: none; }
    #light-field { position: absolute; inset: 0; width: 1080px; height: 2340px; pointer-events: none; }
    /* Reuses the installed vignette component. It frames a light event, not UI chrome. */
    #hf-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 38%, transparent 26%, rgba(38,28,20,.24) 76%, rgba(38,28,20,.44) 100%); }
    audio { display: none; }
  </style>
</head>
<body>
  <div id="stage" data-composition-id="gacha-${tier}" data-start="0" data-duration="${D}" data-fps="30" data-width="1080" data-height="2340" data-root="true">
    <div id="scene" class="clip" data-start="0" data-duration="${D}" data-track-index="0">
      <div id="camera" data-layout-allow-overflow>
        <img id="stage-art" src="assets/reveal-stage.png" alt="" data-layout-ignore>
        <div id="stage-shadow"></div>
        <canvas id="light-field" width="1080" height="2340" data-layout-ignore></canvas>
      </div>
      <div id="hf-vignette"></div>
    </div>
    <audio id="reward-sting" class="clip" data-start="0" data-duration="${musicEnd}" data-track-index="${track}" data-volume="${p.music}" data-automation="${envelope(
      [
        { t: 0, v: 0 },
        { t: 0.12, v: p.music },
        { t: R - 0.18, v: p.music * 0.7 },
        { t: R, v: p.music },
        { t: musicEnd - 0.35, v: p.music * 0.82 },
        { t: musicEnd, v: 0 },
      ],
    )}" src=".media/audio/sfx/sfx_001.mp3"></audio>
    <audio id="release-whoosh" class="clip" data-start="${(R - 0.22).toFixed(2)}" data-duration="0.58" data-track-index="${track + 1}" data-volume="${p.whoosh}" src=".media/audio/sfx/sfx_002.mp3"></audio>
  </div>
  <script>
    // Furniture, rarity text and controls are deliberately absent from this file.
    // One empty stage serves every wallpaper, floor and furniture asset.
    const W = 1080, H = 2340, R = ${R}, D = ${D}, S = ${p.strength};
    const canvas = document.getElementById('light-field');
    const ctx = canvas.getContext('2d');
    const state = { t: 0, gather: 0, bloom: 0, release: 0, dust: 0 };
    const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
    const seed = (i) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
    const motes = Array.from({ length: ${p.particles} }, (_, i) => ({
      x: 220 + seed(i * 3 + 1) * 660,
      y: 560 + seed(i * 7 + 2) * 520,
      size: 2 + seed(i * 11 + 4) * 4,
      phase: seed(i * 13 + 5),
      speed: 60 + seed(i * 17 + 9) * 85,
    }));
    function glow(x, y, rx, ry, alpha, r = 255, g = 228, b = 165) {
      ctx.save();
      ctx.translate(x, y); ctx.scale(rx, ry);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')');
      grad.addColorStop(.34, 'rgba(' + r + ',' + g + ',' + b + ',' + alpha * .46 + ')');
      grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      ctx.fillStyle = grad; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    }
    function paint() {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const t = state.t;
      // The light is born inside the actual illustrated box and rises into its empty portal.
      glow(543, 1120 - state.gather * 155, 180 + state.gather * 85, 270, state.gather * .23 * S);
      glow(520, 820, 350, 430, state.bloom * .36 * S);
      glow(608, 900, 225, 380, state.bloom * .15 * S, 255, 244, 217);
      // An asymmetric sweep avoids perfect graphic rings over the painted ring.
      const sweep = clamp((t - (R - .56)) / .6);
      if (sweep > 0 && sweep < 1) {
        const a = -2.6 + sweep * 3.6;
        glow(540 + Math.cos(a) * 335, 810 + Math.sin(a) * 344, 72, 96, Math.sin(sweep * Math.PI) * .32 * S);
      }
      // Tiny pollen has a fixed seed and a finite lifetime. It never forms a HUD or a confetti cannon.
      motes.forEach((m, i) => {
        const settle = clamp((t - R) / .8);
        const drift = t * m.speed * .18;
        const outward = (m.x - 540) * settle * .27;
        const alpha = state.dust * (.34 + Math.sin(t * 3.2 + m.phase * 6.28) * .18);
        const x = m.x + outward + Math.sin(t + m.phase * 6.28) * 12;
        const y = m.y - drift - settle * (24 + m.phase * 64);
        glow(x, y, m.size * 4, m.size * 5, alpha * .46, 255, 239, 193);
        ctx.fillStyle = 'rgba(255,244,215,' + alpha + ')';
        ctx.beginPath(); ctx.ellipse(x, y, m.size * .5, m.size, m.phase * 4 + t * .1, 0, Math.PI * 2); ctx.fill();
      });
      // Release is one soft lens-light swell, with a protected centre for the alpha artwork.
      glow(540, 995, 600, 540, state.release * .33 * S, 255, 239, 202);
      glow(373, 660, 240, 380, state.release * .2 * S, 255, 248, 224);
    }
    const tl = gsap.timeline({ paused: true });
    tl.addLabel('anticipation', 0);
    tl.addLabel('held-breath', ${Number((R - 0.18).toFixed(2))});
    tl.addLabel('reveal', R);
    tl.addLabel('settled', ${hold});
    tl.fromTo('#camera', { scale: 1.018, y: 12 }, { scale: ${p.zoom}, y: ${Math.round(p.strength * 24)}, duration: ${Number((R - 0.18).toFixed(2))}, ease: 'sine.inOut' }, 0);
    tl.to('#camera', { scale: ${Number((p.zoom + p.strength * 0.012).toFixed(3))}, y: ${Math.round(p.strength * 27)}, duration: .16, ease: 'power2.in' }, ${Number((R - 0.18).toFixed(2))});
    tl.to('#camera', { scale: 1, y: 0, duration: .58, ease: 'power3.out' }, R);
    tl.fromTo('#stage-shadow', { opacity: ${Number((p.dip * 0.65).toFixed(3))} }, { opacity: ${p.dip}, duration: ${Number((R - 0.18).toFixed(2))}, ease: 'sine.inOut' }, 0);
    tl.to('#stage-shadow', { opacity: ${Number((p.dip + 0.05).toFixed(3))}, duration: .16, ease: 'power2.in' }, ${Number((R - 0.18).toFixed(2))});
    tl.to('#stage-shadow', { opacity: .035, duration: .38, ease: 'power3.out' }, R);
    tl.fromTo('#hf-vignette', { opacity: .4 }, { opacity: ${Number((0.45 + p.strength * 0.45).toFixed(2))}, duration: R, ease: 'sine.inOut' }, 0);
    tl.to('#hf-vignette', { opacity: .34, duration: .58, ease: 'power2.out' }, R);
    tl.to(state, { gather: .88, dust: .4 * S, duration: ${Number((R - 0.18).toFixed(2))}, ease: 'power2.inOut' }, 0);
    tl.to(state, { gather: .55, dust: .12 * S, duration: .16, ease: 'power2.in' }, ${Number((R - 0.18).toFixed(2))});
    tl.to(state, { release: 1, bloom: .92, gather: 1, dust: .86 * S, duration: .1, ease: 'power4.out' }, R);
    tl.to(state, { release: 0, bloom: .25, gather: .26, dust: .24 * S, duration: .5, ease: 'power2.out' }, ${Number((R + 0.12).toFixed(2))});
    tl.to(state, { bloom: .18, gather: .15, dust: .09 * S, duration: ${Number((D - hold).toFixed(2))}, ease: 'sine.out' }, ${hold});
    tl.to(state, { t: D, duration: D, ease: 'none', onUpdate: paint }, 0);
    window.__timelines['gacha-${tier}'] = tl;
    tl.seek(0);
    paint();
  </script>
</body>
</html>
`;
}

mkdirSync(join(project, 'compositions'), { recursive: true });
for (const [tier, p] of Object.entries(profiles)) {
  writeFileSync(
    join(project, 'compositions', `${tier}.html`),
    await format(shell(tier, p), { ...formatterOptions, parser: 'html' }),
  );
}
const defaultShell = await format(shell('legendary', profiles.legendary), {
  ...formatterOptions,
  parser: 'html',
});
writeFileSync(join(project, 'index.html'), defaultShell);
writeFileSync(join(project, 'compositions', 'index.html'), defaultShell);
writeFileSync(
  join(project, 'timing-contract.json'),
  await format(
    JSON.stringify(
      {
        canvas: { width: 1080, height: 2340 },
        output: { width: 720, height: 1560, fps: 30, codec: 'h264', audioCodec: 'aac' },
        furniture: {
          center: { x: 540, y: 780 },
          peakMaxWidth: 470,
          peakMaxHeight: 460,
          restWidth: 439,
          restHeight: 430,
          transparent: true,
        },
        tiers: profiles,
      },
      null,
      2,
    ),
    { ...formatterOptions, parser: 'json' },
  ),
);
console.log('Built 3 furniture-free cinematic shells.');
