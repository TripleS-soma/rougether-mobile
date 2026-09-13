import type { Minigame } from '@/api/minigames';

/**
 * 물리 계약 번호 — 서버 `MinigameCatalog.CURRENT_RULES_VERSION`과 같아야 한다.
 * v3 (#1322): 러너 속도가 40초 이후에도 10초마다 +1, 장애물 최대 높이 84→96.
 * 계단·합치기는 v2와 동일(엔진이 `rulesVersion === 1 ? … : …`로 분기).
 */
export const CURRENT_MINIGAME_RULES_VERSION = 3;

export type MinigameCode = 'room-runner' | 'cat-stairs' | 'cat-merge';
export type MinigameDefinition = Minigame & {
  gameCode: MinigameCode;
  maxTicks: number;
  instructions: string;
  pose: number;
};

/** Only installed, version-matched game implementations may be offered for play. */
export const MINIGAME_DEFINITIONS: Record<MinigameCode, MinigameDefinition> = {
  'room-runner': {
    gameCode: 'room-runner',
    name: '루틴 러너',
    description: '탭해서 장애물을 넘고, 최고 기록에 도전해요.',
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    maxTicks: 18000,
    instructions: '탭해서 점프',
    pose: 1,
  },
  'cat-stairs': {
    gameCode: 'cat-stairs',
    name: '고양이 계단',
    description: '왼쪽, 오른쪽! 고양이와 더 높이 올라가요.',
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    maxTicks: 7200,
    instructions: '다음 계단 방향으로 이동',
    pose: 2,
  },
  'cat-merge': {
    gameCode: 'cat-merge',
    name: '고양이 합치기',
    description: '같은 숫자의 고양이를 합쳐 더 큰 숫자를 만들어요.',
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    maxTicks: 18000,
    instructions: '밀어서 같은 숫자 합치기',
    pose: 3,
  },
};

export const PLAYABLE_MINIGAMES = Object.values(MINIGAME_DEFINITIONS);

export function getMinigameDefinition(gameCode: string): MinigameDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(MINIGAME_DEFINITIONS, gameCode)
    ? MINIGAME_DEFINITIONS[gameCode as MinigameCode]
    : undefined;
}
