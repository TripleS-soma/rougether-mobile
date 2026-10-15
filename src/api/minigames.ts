import { apiGet, apiGetList, apiPost } from '@/api/client';
import type { MinigameFinishRequest } from '@/api/types';

export type Minigame = {
  gameCode: string;
  name: string;
  description: string;
  rulesVersion: number;
};

export type MinigameRun = {
  runId: string;
  gameCode: string;
  rulesVersion: number;
  seed: number;
  maxTicks: number;
  expiresAt: string;
};

export type MinigameDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
export type MinigameAction = { tick: number; direction: MinigameDirection };
/**
 * 고양이 털실 정리(cat-yarn) 제출 — 집은 더미 번호(0..5) 순서, `ticks`는 집은 횟수(최소 1).
 * 서버 `MinigameFinishRequest.picks`(최대 2000, server #447) — jumpTicks·actions와 함께 보내지 않는다.
 */
export type MinigamePickReplay = Required<Pick<MinigameFinishRequest, 'ticks' | 'picks'>>;
export type MinigameReplay =
  | { ticks: number; jumpTicks: number[] }
  | { ticks: number; actions: MinigameAction[] }
  | MinigamePickReplay;
export type MinigameResult = {
  runId: string;
  score: number;
  bestScore: number;
  personalBest: boolean;
  rank: number;
  /**
   * 이 게임의 내 랭킹전 완료 횟수(이번 판 포함). 피드 자랑 제안(10판 이상)의 조건이다.
   * 숫자가 아니면 0으로 받는다(제안 없음) — 서버 #446 이전 응답 대비.
   */
  playCount: number;
};
export type MinigameRankingEntry = {
  rank: number;
  userId: number;
  nickname: string;
  score: number;
};
export type MinigameLeaderboard = {
  items: MinigameRankingEntry[];
  myEntry: MinigameRankingEntry | null;
  totalPlayers: number;
};

const gamePath = (gameCode: string) => `/minigames/${encodeURIComponent(gameCode)}`;

export function fetchMinigames(rulesVersion: number) {
  return apiGetList<Minigame>(`/minigames?rulesVersion=${rulesVersion}`);
}
export function startMinigameRun(gameCode: string, rulesVersion: number) {
  return apiPost<MinigameRun>(`${gamePath(gameCode)}/runs?rulesVersion=${rulesVersion}`);
}
export async function finishMinigameRun(
  gameCode: string,
  runId: string,
  replay: MinigameReplay,
): Promise<MinigameResult> {
  const res = await apiPost<Omit<MinigameResult, 'playCount'> & { playCount?: number }>(
    `${gamePath(gameCode)}/runs/${encodeURIComponent(runId)}/finish`,
    replay,
  );
  const playCount = res.playCount;
  return {
    ...res,
    playCount: typeof playCount === 'number' && Number.isFinite(playCount) ? playCount : 0,
  };
}
export function fetchMinigameLeaderboard(gameCode: string) {
  return apiGet<MinigameLeaderboard>(`${gamePath(gameCode)}/leaderboard`);
}
