/**
 * Character metadata, ported from the prototype `character.ts`. Each character
 * has 4 static pose frames (assets/images/characters/<id>-1..4.webp, wired
 * through CharacterAvatar; 나의 방 cycles poses on tap, elsewhere pose 0); the
 * `emoji` is a fallback used where the frame isn't shown. Pure data — reusable
 * across onboarding, room, etc.
 */
export type CharacterId = 'cat' | 'dog' | 'tiger' | 'panda' | 'bear' | 'sheep' | 'horse' | 'otter';

export type CharacterOption = {
  id: CharacterId;
  name: string;
  description: string;
  /** Fallback glyph used where the animated sprite isn't rendered. */
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
  {
    id: 'panda',
    name: '판다',
    description: '느긋하고 다정한 루틴 친구',
    emoji: '🐼',
    bg: '#EDEDED',
  },
  { id: 'bear', name: '곰', description: '든든하고 포근한 루틴 친구', emoji: '🐻', bg: '#F0E4D4' },
  { id: 'sheep', name: '양', description: '부드럽고 순한 루틴 친구', emoji: '🐑', bg: '#F3EFE8' },
  {
    id: 'horse',
    name: '망아지',
    description: '씩씩하고 활기찬 루틴 친구',
    emoji: '🐴',
    bg: '#F3E7D6',
  },
  {
    id: 'otter',
    name: '수달',
    description: '장난기 많고 사랑스러운 루틴 친구',
    emoji: '🦦',
    bg: '#E6E0D6',
  },
];

export const DEFAULT_CHARACTER_ID: CharacterId = 'cat';
