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
