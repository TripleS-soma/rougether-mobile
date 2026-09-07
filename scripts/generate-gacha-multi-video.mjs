#!/usr/bin/env node
/**
 * Rebuild the multi-draw ambient movie with local ffmpeg/ffprobe only.
 *
 *   node scripts/generate-gacha-multi-video.mjs
 *   node scripts/generate-gacha-multi-video.mjs --check
 *   node scripts/generate-gacha-multi-video.mjs --timing
 *   node scripts/generate-gacha-multi-video.mjs --output /tmp/gacha-multi.mp4
 *
 * Provenance: the existing common movie's empty lower-floor region at 0.7 s.
 * No gift, reward, card, rarity cue, or original soundtrack is baked in. Actual
 * result artwork and rarity effects remain the application's responsibility.
 * The six original synthesized glass notes start at the reveal beats below;
 * consumers with fewer results must stop/mute before their next unused beat.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, 'assets/videos/gacha-reveal-common.mp4');
const defaultOutput = resolve(projectRoot, 'assets/videos/gacha-reveal-multi.mp4');
const timing = JSON.parse(
  readFileSync(resolve(projectRoot, 'src/constants/gacha-multi-timing.json'), 'utf8'),
);
const revealBeatsMs = Array.from(
  { length: timing.maxItems },
  (_, index) => timing.leadInMs + index * timing.beatMs,
);
const durationSeconds = (revealBeatsMs.at(-1) + timing.finalHoldMs) / 1000;
const frameRate = 30;
const frameCount = Math.round(durationSeconds * frameRate);
const sampleRate = 48000;
const frequenciesHz = [659.255, 783.991, 880, 1046.502, 1174.659, 1318.51];

function run(command, args, encoding = 'utf8') {
  const result = spawnSync(command, args, {
    encoding,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr.toString()}`);
  }
  return result.stdout;
}

function parseArguments(args) {
  let output = defaultOutput;
  let checkOnly = false;
  let timingOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--check') {
      checkOnly = true;
    } else if (args[index] === '--timing') {
      timingOnly = true;
    } else if (args[index] === '--output' && args[index + 1]) {
      output = resolve(args[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${args[index]}`);
    }
  }
  if (output === source) throw new Error('The source movie must not be overwritten.');
  if (!output.endsWith('.mp4')) throw new Error('The output must end in .mp4.');
  return { output, checkOnly, timingOnly };
}

function render(output) {
  if (revealBeatsMs.length !== frequenciesHz.length)
    throw new Error('Each configured reveal beat must have an authored glass note.');
  const video = [
    '[0:v]trim=end_frame=1',
    'setpts=PTS-STARTPTS',
    // Preserve the original image aspect ratio; crop only empty floorboards.
    'crop=208:450:256:1110',
    'scale=720:1560:flags=lanczos',
    `zoompan=z='1+on*0.00011':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frameCount}:s=360x780:fps=${frameRate}`,
    'eq=brightness=-0.045:saturation=0.86:contrast=0.98',
    'vignette=angle=PI/6',
    'setsar=1',
    'format=yuv420p[v]',
  ].join(',');

  const notes = revealBeatsMs.map((beatMs, index) => {
    const fundamental = frequenciesHz[index];
    // Short inharmonic partials make a struck glass bell, not a square-wave beep.
    // The 2 ms attack and continuous exponential decay avoid clicks. With no
    // normalization, even overlapping tails retain ample unclipped headroom.
    const tone =
      `0.22*(1-exp(-t/0.002))*exp(-t/0.21)*(` +
      `sin(2*PI*${fundamental}*t)+` +
      `0.28*sin(2*PI*${fundamental}*2.756*t)*exp(-t/0.055)+` +
      `0.10*sin(2*PI*${fundamental}*4.11*t)*exp(-t/0.028))`;
    return (
      `aevalsrc='${tone}':s=${sampleRate}:d=0.95,` +
      'aformat=channel_layouts=stereo,' +
      'aecho=0.95:1:73|109:0.10|0.055,' +
      `adelay=${beatMs}:all=1,asetpts=N/SR/TB[n${index}]`
    );
  });
  const mix =
    revealBeatsMs.map((_, index) => `[n${index}]`).join('') +
    `amix=inputs=${revealBeatsMs.length}:duration=longest:normalize=0,` +
    `apad=whole_dur=${durationSeconds},atrim=duration=${durationSeconds},` +
    `afade=t=out:st=${durationSeconds - 0.25}:d=0.25,asetpts=N/SR/TB[a]`;

  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    '0.7',
    '-i',
    source,
    '-filter_complex',
    [video, ...notes, mix].join(';'),
    // Explicit mappings deliberately discard the source movie's audio.
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-map_metadata',
    '-1',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '25',
    '-threads',
    '1',
    '-profile:v',
    'main',
    '-level:v',
    '3.1',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    String(sampleRate),
    '-ac',
    '2',
    '-t',
    String(durationSeconds),
    '-movflags',
    '+faststart',
    output,
  ]);
}

function verify(output) {
  const probe = JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration,start_time,sample_rate,channels:format=duration,size',
      '-of',
      'json',
      output,
    ]),
  );
  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
  if (
    probe.streams.length !== 2 ||
    video?.codec_name !== 'h264' ||
    video.width !== 360 ||
    video.height !== 780 ||
    video.r_frame_rate !== `${frameRate}/1` ||
    Number(video.nb_frames) !== frameCount ||
    audio?.codec_name !== 'aac' ||
    Number(audio.sample_rate) !== sampleRate ||
    audio.channels !== 2 ||
    Number(audio.start_time) !== 0 ||
    Math.abs(Number(audio.duration) - durationSeconds) > 0.01 ||
    Math.abs(Number(probe.format.duration) - durationSeconds) > 0.01
  ) {
    throw new Error('Unexpected output streams, dimensions, frame count, or duration.');
  }
  const bytes = statSync(output).size;
  if (bytes > 500_000) throw new Error(`OTA asset exceeds 500 kB: ${bytes} bytes.`);

  // Check decoded AAC, not just the pre-encode signal, for clipping and six
  // audible attacks. Buffer decoding is local and creates no extra files.
  const pcm = run(
    'ffmpeg',
    ['-v', 'error', '-i', output, '-vn', '-f', 'f32le', '-ac', '1', '-ar', String(sampleRate), '-'],
    null,
  );
  let peak = 0;
  for (let offset = 0; offset + 4 <= pcm.length; offset += 4) {
    peak = Math.max(peak, Math.abs(pcm.readFloatLE(offset)));
  }
  if (peak >= 0.95 || peak < 0.1) throw new Error(`Unexpected decoded audio peak: ${peak}.`);

  const rmsBetween = (startMs, endMs) => {
    const start = Math.floor((startMs / 1000) * sampleRate);
    const end = Math.min(Math.floor((endMs / 1000) * sampleRate), pcm.length / 4);
    let energy = 0;
    for (let sample = start; sample < end; sample += 1) {
      energy += pcm.readFloatLE(sample * 4) ** 2;
    }
    return Math.sqrt(energy / (end - start));
  };
  const attacks = revealBeatsMs.map((beatMs) => {
    const attackRms = rmsBetween(beatMs + 4, beatMs + 40);
    const beforeRms = rmsBetween(beatMs - 40, beatMs - 4);
    if (attackRms < 0.075 || attackRms < beforeRms * 4) {
      throw new Error(`Missing or weak chime attack at ${beatMs} ms.`);
    }
    return { beatMs, attackRms: Number(attackRms.toFixed(4)) };
  });
  console.log(
    JSON.stringify(
      {
        output,
        bytes,
        durationSeconds: Number(probe.format.duration),
        streams: probe.streams,
        decodedPeakDbfs: Number((20 * Math.log10(peak)).toFixed(2)),
        attacks,
      },
      null,
      2,
    ),
  );
}

try {
  const { output, checkOnly, timingOnly } = parseArguments(process.argv.slice(2));
  if (timingOnly) {
    console.log(JSON.stringify({ revealBeatsMs, durationSeconds, frameCount }));
  } else {
    if (!checkOnly) render(output);
    verify(output);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
