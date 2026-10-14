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
  /**
   * 이 게임의 내 랭킹전 완료 횟수(이번 판 포함). 피드 자랑 제안(10판 이상)의 조건이다.
   * 서버(feat/feed-minigame-record) 배포 전 응답엔 없으므로 0으로 받는다(제안 없음).
   */
  playCount: number;
};
/**
 * POST …/finish 원본 응답 — `playCount`가 아직 생성 타입(`MinigameFinishResponse`)에 없다.
 * TODO(gen:api-types): 서버 PR 배포 후 재생성하면 이 로컬 타입을 지우고 생성 타입을 쓴다.
 */
type MinigameFinishWire = Omit<MinigameResult, 'playCount'> & { playCount?: number };
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
  const res = await apiPost<MinigameFinishWire>(
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
