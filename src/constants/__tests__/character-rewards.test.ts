import { CHARACTER_OPTIONS, STARTER_CHARACTER_OPTIONS } from '@/constants/characters';

it('recognizes Moru as a level 5 reward while keeping free starter choices unchanged', () => {
  expect(CHARACTER_OPTIONS.find((c) => c.id === 'moru')).toMatchObject({
    name: '모루',
    rewardLevel: 5,
  });
  expect(STARTER_CHARACTER_OPTIONS.map((c) => c.id)).toEqual([
    'cat',
    'dog',
    'tiger',
    'panda',
    'bear',
    'sheep',
    'horse',
    'otter',
  ]);
});
