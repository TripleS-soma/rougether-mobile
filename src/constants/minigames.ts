import type { Minigame } from '@/api/minigames';

export type MinigameCode = 'room-runner' | 'cat-stairs' | 'cat-merge';
export type MinigameDefinition = Minigame & {
  gameCode: MinigameCode;
  maxTicks: number;
  instructions: string;
  readyTitle: string;
  tagline: string;
  pose: number;
};

/** Only installed, version-matched game implementations may be offered for play. */
export const MINIGAME_DEFINITIONS: Record<MinigameCode, MinigameDefinition> = {
  'room-runner': {
    gameCode: 'room-runner',
    name: '루틴 러너',
    description: '탭해서 장애물을 넘고, 최고 기록에 도전해요.',
    rulesVersion: 1,
    maxTicks: 18000,
    instructions: '화면을 탭해 장애물을 뛰어넘어요.\n오래 달릴수록 점수가 올라가요.',
    readyTitle: '고양이와 함께 폴짝!',
    tagline: '탭 한 번으로 폴짝!',
    pose: 1,
  },
  'cat-stairs': {
    gameCode: 'cat-stairs',
    name: '고양이 계단',
    description: '왼쪽, 오른쪽! 고양이와 더 높이 올라가요.',
    rulesVersion: 1,
    maxTicks: 7200,
    instructions:
      '다음 계단 방향에 맞춰 왼쪽·오른쪽 버튼을 눌러요.\n방향을 틀리거나 시간이 지나면 게임이 끝나요.',
    readyTitle: '한 계단씩, 더 높은 곳으로!',
    tagline: '왼쪽, 오른쪽, 한 계단씩!',
    pose: 2,
  },
  'cat-merge': {
    gameCode: 'cat-merge',
    name: '고양이 합치기',
    description: '같은 숫자의 고양이를 합쳐 더 큰 숫자를 만들어요.',
    rulesVersion: 1,
    maxTicks: 18000,
    instructions:
      '밀어서 같은 숫자의 고양이 타일을 합쳐요.\n방향 버튼도 쓸 수 있어요. 그만할 때 기록을 저장해요.',
    readyTitle: '같은 고양이가 만나면?',
    tagline: '차근차근, 더 큰 숫자로!',
    pose: 3,
  },
};

export const PLAYABLE_MINIGAMES = Object.values(MINIGAME_DEFINITIONS);

export function getMinigameDefinition(gameCode: string): MinigameDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(MINIGAME_DEFINITIONS, gameCode)
    ? MINIGAME_DEFINITIONS[gameCode as MinigameCode]
    : undefined;
}
