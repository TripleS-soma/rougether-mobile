// Build looping animated WebP character sprites from the source frame strips.
//
// Source: assets/characters/<id>.png — a horizontal strip of 4 equal frames
//         (transparent background), in animation order.
// Output: assets/images/characters/<id>.webp — a 4-frame looping animation
//         (these are what the app bundles; see CharacterAvatar).
//
// Run with: npm run build:characters   (requires the `sharp` devDependency)

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'characters');
const OUT = path.join(__dirname, '..', 'assets', 'images', 'characters');
const FRAMES = 4;
const DELAY_MS = 480; // per-frame hold → ~1.9s loop

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.png'));
  for (const file of files) {
    const name = path.basename(file, '.png');
    const src = path.join(SRC, file);
    const { width, height } = await sharp(src).metadata();
    const fw = Math.floor(width / FRAMES);

    const frames = [];
    for (let i = 0; i < FRAMES; i++) {
      frames.push(
        await sharp(src)
          .extract({ left: i * fw, top: 0, width: fw, height })
          .png()
          .toBuffer(),
      );
    }

    const outPath = path.join(OUT, `${name}.webp`);
    await sharp(frames, { join: { animated: true } })
      .webp({ quality: 90, effort: 5, loop: 0, delay: Array(FRAMES).fill(DELAY_MS) })
      .toFile(outPath);

    const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`${name}: ${fw}x${height} x${FRAMES}f -> ${kb}KB`);
  }
  console.log('done ->', path.relative(process.cwd(), OUT));
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
