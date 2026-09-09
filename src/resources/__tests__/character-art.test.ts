import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { approvedCharacterPoses, approvedCharacterPoster } from '@/resources/character-art';

describe('reviewed character artwork', () => {
  it.each([
    'characters/cat.png',
    '/characters/cat_sitting_figma_ready_v2.png',
    'characters/cat/poses/wink.webp',
    'characters/cat/animations/idle.webp',
  ])('replaces the legacy cat poster at %s', (key) => {
    expect(approvedCharacterPoster(key)).toBe(approvedCharacterPoses('cat')?.[0]);
  });

  it.each([
    'characters/caterpillar.png',
    'items/cat/bed.webp',
    'characters/panda/idle.webp',
    undefined,
  ])('leaves unrelated artwork untouched: %s', (key) =>
    expect(approvedCharacterPoster(key)).toBeUndefined(),
  );
});

function webpAnimation(name: string) {
  const data = readFileSync(
    resolve(__dirname, `../../../assets/images/characters/cat-approved-${name}.webp`),
  );
  expect(data.toString('ascii', 0, 4)).toBe('RIFF');
  expect(data.toString('ascii', 8, 12)).toBe('WEBP');
  let frames = 0;
  let loop: number | undefined;
  for (let offset = 12; offset + 8 <= data.length;) {
    const type = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    expect(offset + 8 + size).toBeLessThanOrEqual(data.length);
    if (type === 'ANIM') loop = data.readUInt16LE(offset + 12);
    if (type === 'ANMF') frames++;
    offset += 8 + size + (size % 2);
  }
  return { frames, loop };
}

describe('bundled cat motion contract', () => {
  it('ships eight multi-frame infinite loops for the own-room cycle', () => {
    const names = ['idle', 'blink', 'wink', 'seated', 'wave', 'stretch', 'sleep', 'groom'];
    expect(approvedCharacterPoses('cat')).toHaveLength(names.length);
    for (const name of names) {
      const animation = webpAnimation(name);
      expect(animation.frames).toBeGreaterThan(1);
      expect(animation.loop).toBe(0);
    }
  });

  it('ships a separate single image for friend rooms', () => {
    expect(webpAnimation('still')).toEqual({ frames: 0, loop: undefined });
  });
});
