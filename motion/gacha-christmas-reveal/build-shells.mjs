import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import prettier from 'prettier';
const root = path.dirname(fileURLToPath(import.meta.url));
const template = await readFile(path.join(root, 'shell-template.txt'), 'utf8');
const single = `
tl.addLabel('anticipation', 0.25);
tl.addLabel('held-breath', 1.32);
tl.addLabel('reveal', REVEAL);
tl.addLabel('settled', 2.12);
tl.fromTo('#gifts', { rotation: 0, scale: 1, y: 0 }, { rotation: -3, scale: 0.98, duration: 0.2, ease: 'sine.inOut' }, 0.25);
tl.to('#gifts', { rotation: 3, duration: 0.16, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0.45);
tl.to('#gifts', { rotation: 0, scale: 0.96, y: 5, duration: 0.23, ease: 'power2.in' }, 1.09);
tl.to('#gifts', { scale: 0.82, y: 10, rotation: 0, duration: 0.57, ease: 'back.out(1.2)' }, REVEAL);
`;
const multi = `
tl.addLabel('reveal', REVEAL);
tl.fromTo('#gifts', { rotation: 0, scale: 1, y: 0 }, { rotation: -3, scale: 0.98, duration: 0.12, ease: 'sine.inOut' }, 0.05);
tl.to('#gifts', { rotation: 3, duration: 0.1, repeat: 2, yoyo: true, ease: 'sine.inOut' }, 0.17);
tl.to('#gifts', { rotation: 0, scale: 0.96, y: 5, duration: 0.13, ease: 'power2.in' }, 0.47);
tl.to('#gifts', { scale: 0.82, y: 10, rotation: 0, duration: 0.4, ease: 'back.out(1.2)' }, REVEAL);
REVEALS.slice(1).forEach((onset) => {
  tl.to('#gifts', { scale: 0.85, duration: 0.1, ease: 'sine.in' }, onset - 0.12);
  tl.to('#gifts', { scale: 0.82, duration: 0.25, ease: 'sine.out' }, onset);
});
`;
const timing = JSON.parse(
  await readFile(path.join(root, '../../src/constants/gacha-multi-timing.json'), 'utf8'),
);
const beats = Array.from(
  { length: timing.maxItems },
  (_, i) => (timing.leadInMs + i * timing.beatMs) / 1000,
);
const duration = beats.at(-1) + timing.finalHoldMs / 1000;
for (const config of [
  {
    file: 'index.html',
    id: 'christmas-gift',
    duration: 3.4,
    reveal: 1.55,
    beats: [1.55],
    motion: single,
  },
  {
    file: 'compositions/multi.html',
    id: 'christmas-gift-multi',
    duration,
    reveal: beats[0],
    beats,
    motion: multi,
  },
]) {
  let html = template
    .replaceAll('{{ID}}', config.id)
    .replaceAll('{{DURATION}}', String(config.duration))
    .replace('{{REVEAL}}', String(config.reveal))
    .replace('{{REVEALS}}', JSON.stringify(config.beats))
    .replace('{{GIFT_MOTION}}', config.motion);
  if (config.id === 'christmas-gift-multi') {
    html = html.replace(
      '#wreath { left: 270px; top: 130px; width: 180px; height: 180px; }',
      '#wreath { left: 535px; top: 100px; width: 135px; height: 135px; }',
    );
  }
  await writeFile(
    path.join(root, config.file),
    await prettier.format(html, {
      ...(await prettier.resolveConfig(path.join(root, 'index.html'))),
      parser: 'html',
    }),
  );
}
