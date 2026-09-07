import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = dirname(fileURLToPath(import.meta.url));
const app = resolve(project, '../..');
const tiers = { common: 2.4, rare: 2.7, legendary: 2.9 };
const run = (args) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status})`);
};

mkdirSync(resolve(app, 'assets/videos'), { recursive: true });
mkdirSync(resolve(app, 'assets/images/gacha'), { recursive: true });
for (const [tier, duration] of Object.entries(tiers)) {
  const master = resolve(project, `renders/gacha-reveal-${tier}-master.mp4`);
  const video = resolve(app, `assets/videos/gacha-reveal-${tier}.mp4`);
  const poster = resolve(app, `assets/images/gacha/cinematic-${tier}.jpg`);
  run([
    '-i',
    master,
    '-vf',
    'scale=720:1560:flags=lanczos',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    video,
  ]);
  run(['-ss', String(duration - 1 / 30), '-i', video, '-frames:v', '1', '-q:v', '2', poster]);
  console.log(`${tier}: ${duration}s, 720×1560, poster ready`);
}
