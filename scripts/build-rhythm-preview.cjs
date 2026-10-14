const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

async function build() {
  const output = path.resolve('output/rhythm');
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({
    entryPoints: ['src/features/minigame/rhythm-html.ts'],
    outfile: path.join(output, 'generator.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    loader: { '.css': 'empty' },
    keepNames: true,
  });
  const { createRhythmHtml } = require(path.join(output, 'generator.cjs'));
  fs.writeFileSync(
    path.join(output, 'index.html'),
    createRhythmHtml({ channelId: 'rhythm-local-preview', allowManualTime: true }),
  );
  process.stdout.write(`Rhythm preview: ${path.join(output, 'index.html')}\n`);
}
build().catch((error) => {
  process.stderr.write(String(error));
  process.exitCode = 1;
});
