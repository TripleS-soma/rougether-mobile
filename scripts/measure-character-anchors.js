// Measure first-frame alpha > 30 in a square contain frame. No images are modified.
// Run: node scripts/measure-character-anchors.js [additional-public-asset-key ...]
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const sharp = require(path.join(root, 'node_modules/sharp'));
async function anchor(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * info.channels + info.channels - 1] > 30) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
  if (maxX < 0) throw Error('Empty image');
  const side = Math.max(info.width, info.height);
  return {
    centerOffset: (minX + maxX + 1 - info.width) / 2 / side,
    bottomInset: ((side - info.height) / 2 + info.height - maxY - 1) / side,
  };
}
(async () => {
  const out = {};
  const names = ['bear', 'cat', 'dog', 'horse', 'otter', 'panda', 'sheep', 'tiger'];
  for (const n of names)
    for (let i = 1; i <= 4; i++)
      out[`${n}-${i}`] = await anchor(path.join(root, `assets/images/characters/${n}-${i}.webp`));
  const existing = JSON.parse(
    fs.readFileSync(path.join(root, 'src/components/room/character-art-anchors.json'), 'utf8'),
  );
  const keys = [
    ...new Set([
      ...Object.keys(existing).filter((key) => key.startsWith('characters/')),
      ...process.argv.slice(2),
    ]),
  ];
  for (let i = 0; i < keys.length; i += 4)
    await Promise.all(
      keys.slice(i, i + 4).map(async (key) => {
        const response = await fetch(
          `${require(path.join(root, 'src/config/shared-endpoints.json')).assetBase}/${key}`,
          { signal: AbortSignal.timeout(12000) },
        );
        if (!response.ok) throw Error(`Cannot measure ${key}: HTTP ${response.status}`);
        out[key] = await anchor(Buffer.from(await response.arrayBuffer()));
      }),
    );
  fs.writeFileSync(
    path.join(root, 'src/components/room/character-art-anchors.json'),
    JSON.stringify(
      Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b))),
      null,
      2,
    ) + '\n',
  );
  console.log('Anchors:', Object.keys(out).length);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
