/**
 * Character metadata, ported from the prototype `character.ts`. Sprite images
 * are replaced with an emoji placeholder for now (TODO: port the character art
 * + CharacterAvatar). Pure data — reusable across onboarding, room, etc.
 */
export type CharacterId = 'cat' | 'dog' | 'tiger';

export type CharacterOption = {
  id: CharacterId;
  name: string;
  description: string;
  /** Placeholder until real sprites are ported. */
  emoji: string;
  bg: string;
};

export const CHARACTER_OPTIONS: CharacterOption[] = [
  {
    id: 'cat',
    name: '고양이',
    description: '조용하고 따뜻한 루틴 친구',
    emoji: '🐱',
    bg: '#F5E6D3',
  },
  { id: 'dog', name: '강아지', description: '밝고 활발한 루틴 친구', emoji: '🐶', bg: '#E3EEF8' },
  {
    id: 'tiger',
    name: '호랑이',
    description: '당차고 용감한 루틴 친구',
    emoji: '🐯',
    bg: '#FFF0D8',
  },
];

export const DEFAULT_CHARACTER_ID: CharacterId = 'cat';
