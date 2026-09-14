import type { Minigame } from '@/api/minigames';
import { i18n } from '@/i18n';

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

/**
 * Only installed, version-matched game implementations may be offered for play.
 * 문구(name·description·instructions)는 getter — 모듈 로드 시점에 번역하면 언어 변경이
 * 반영되지 않는다 (#893).
 */
export const MINIGAME_DEFINITIONS: Record<MinigameCode, MinigameDefinition> = {
  'room-runner': {
    gameCode: 'room-runner',
    get name() {
      return i18n.t('roomShop.minigame.runner.name');
    },
    get description() {
      return i18n.t('roomShop.minigame.runner.description');
    },
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    maxTicks: 18000,
    get instructions() {
      return i18n.t('roomShop.minigame.runner.instructions');
    },
    pose: 1,
  },
  'cat-stairs': {
    gameCode: 'cat-stairs',
    get name() {
      return i18n.t('roomShop.minigame.stairs.name');
    },
    get description() {
      return i18n.t('roomShop.minigame.stairs.description');
    },
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    maxTicks: 7200,
    get instructions() {
      return i18n.t('roomShop.minigame.stairs.instructions');
    },
    pose: 2,
  },
  'cat-merge': {
    gameCode: 'cat-merge',
    get name() {
      return i18n.t('roomShop.minigame.merge.name');
    },
    get description() {
      return i18n.t('roomShop.minigame.merge.description');
    },
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    maxTicks: 18000,
    get instructions() {
      return i18n.t('roomShop.minigame.merge.instructions');
    },
    pose: 3,
  },
};

export const PLAYABLE_MINIGAMES = Object.values(MINIGAME_DEFINITIONS);

export function getMinigameDefinition(gameCode: string): MinigameDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(MINIGAME_DEFINITIONS, gameCode)
    ? MINIGAME_DEFINITIONS[gameCode as MinigameCode]
    : undefined;
}
