import type { Minigame, MinigameResult } from '@/api/minigames';
import { i18n } from '@/i18n';

/**
 * 물리 계약 번호 — 서버 `MinigameCatalog.CURRENT_RULES_VERSION`과 같아야 한다.
 * v3 (#1322): 러너 속도가 40초 이후에도 10초마다 +1, 장애물 최대 높이 84→96.
 * 계단·합치기는 v2와 동일(엔진이 `rulesVersion === 1 ? … : …`로 분기).
 * 탑 쌓기(#1529)는 v3에서 처음 생긴 게임이라 v3 규칙만 있다.
 */
export const CURRENT_MINIGAME_RULES_VERSION = 3;

export type MinigameCode = 'room-runner' | 'cat-stairs' | 'cat-merge' | 'cat-tower';
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
  'cat-tower': {
    gameCode: 'cat-tower',
    get name() {
      return i18n.t('roomShop.minigame.tower.name');
    },
    get description() {
      return i18n.t('roomShop.minigame.tower.description');
    },
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    maxTicks: 18000,
    get instructions() {
      return i18n.t('roomShop.minigame.tower.instructions');
    },
    // 캐릭터 포즈 프레임은 0~3 네 장 — 남은 0번.
    pose: 0,
  },
};

export const PLAYABLE_MINIGAMES = Object.values(MINIGAME_DEFINITIONS);

export function getMinigameDefinition(gameCode: string): MinigameDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(MINIGAME_DEFINITIONS, gameCode)
    ? MINIGAME_DEFINITIONS[gameCode as MinigameCode]
    : undefined;
}

/**
 * 새 최고 기록을 피드에 자랑하자고 제안하는 최소 판 수 (2026-10-14 제품 오너 결정) — 그 게임의
 * 랭킹전을 이만큼 끝낸 사람에게만(서버 `playCount`, 이번 판 포함). 처음 몇 판은 매번 최고
 * 기록이라 제안이 소음이 된다.
 */
export const MINIGAME_SHARE_MIN_PLAYS = 10;

/**
 * 결과 화면에서 [자랑하기]를 제안할까 — 랭킹전(연습 아님) · 새 최고 기록 · 그 게임 10판 이상 ·
 * 피드가 켜져 있을 때만. 판당 한 번만 보이는 건 셸(`use-minigame-surface`)이 지킨다.
 */
export function canOfferRecordShare(
  result: Pick<MinigameResult, 'personalBest' | 'playCount'> | null | undefined,
  { practice, feedEnabled }: { practice: boolean; feedEnabled: boolean },
): boolean {
  if (!result || practice || !feedEnabled) return false;
  return result.personalBest && result.playCount >= MINIGAME_SHARE_MIN_PLAYS;
}
