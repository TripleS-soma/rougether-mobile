import { apiGet, apiGetList, apiPost } from '@/api/client';

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
export type MinigameReplay =
  { ticks: number; jumpTicks: number[] } | { ticks: number; actions: MinigameAction[] };
export type MinigameResult = {
  runId: string;
  score: number;
  bestScore: number;
  personalBest: boolean;
  rank: number;
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
export function finishMinigameRun(gameCode: string, runId: string, replay: MinigameReplay) {
  return apiPost<MinigameResult>(
    `${gamePath(gameCode)}/runs/${encodeURIComponent(runId)}/finish`,
    replay,
  );
}
export function fetchMinigameLeaderboard(gameCode: string) {
  return apiGet<MinigameLeaderboard>(`${gamePath(gameCode)}/leaderboard`);
}
