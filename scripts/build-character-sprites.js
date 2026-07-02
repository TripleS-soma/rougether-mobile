// Build per-pose static WebP character frames from the source frame strips.
//
// Source: assets/characters/<id>.png — a horizontal strip of 4 equal frames
//         (transparent background), in pose order.
// Output: assets/images/characters/<id>-1.webp … <id>-4.webp — one static WebP
//         per pose (these are what the app bundles; see CharacterAvatar). The
//         room in 나의 방 cycles poses on tap; everywhere else shows pose 1.
//
// Run with: npm run build:characters   (requires the `sharp` devDependency)

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'characters');
const OUT = path.join(__dirname, '..', 'assets', 'images', 'characters');
const FRAMES = 4;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.png'));
  for (const file of files) {
    const name = path.basename(file, '.png');
    const src = path.join(SRC, file);
    const { width, height } = await sharp(src).metadata();
    const fw = Math.floor(width / FRAMES);

    for (let i = 0; i < FRAMES; i++) {
      const outPath = path.join(OUT, `${name}-${i + 1}.webp`);
      await sharp(src)
        .extract({ left: i * fw, top: 0, width: fw, height })
        .webp({ quality: 90, effort: 5 })
        .toFile(outPath);
      const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
      console.log(`${name}-${i + 1}: ${fw}x${height} -> ${kb}KB`);
    }
  }
  console.log('done ->', path.relative(process.cwd(), OUT));
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
