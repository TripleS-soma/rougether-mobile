import { API_BASE } from '@/api/config';
import {
  fetchMinigameLeaderboard,
  fetchMinigames,
  finishMinigameRun,
  startMinigameRun,
  type Minigame,
  type MinigameLeaderboard,
  type MinigameReplay,
  type MinigameResult,
  type MinigameRun,
} from '@/api/minigames';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

function mockResponse(data: unknown) {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const gameCodes = ['room-runner', 'cat-stairs', 'cat-merge'];
const result: MinigameResult = {
  runId: 'run-123',
  score: 240,
  bestScore: 360,
  personalBest: false,
  rank: 12,
};

describe('미니게임 API', () => {
  it('게임 목록의 items를 풀어서 반환한다', async () => {
    const items: Minigame[] = gameCodes.map((gameCode) => ({
      gameCode,
      name: gameCode,
      description: '미니게임 설명',
      rulesVersion: 2,
    }));
    const fetchMock = mockResponse({ items });

    await expect(fetchMinigames(2)).resolves.toEqual(items);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/minigames?rulesVersion=2`,
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
  });

  it.each(gameCodes)('%s의 실행을 해당 게임 경로로 시작한다', async (gameCode) => {
    const run: MinigameRun = {
      runId: 'run-123',
      gameCode,
      rulesVersion: 2,
      seed: 12345,
      maxTicks: gameCode === 'cat-stairs' ? 7200 : 18000,
      expiresAt: '2026-09-12T09:00:00Z',
    };
    const fetchMock = mockResponse(run);

    await expect(startMinigameRun(gameCode, 2)).resolves.toEqual(run);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/minigames/${gameCode}/runs?rulesVersion=2`,
      expect.objectContaining({ method: 'POST', body: undefined }),
    );
  });

  const replays: { gameCode: string; replay: MinigameReplay }[] = [
    {
      gameCode: 'room-runner',
      replay: { ticks: 360, jumpTicks: [30, 120, 210] },
    },
    {
      gameCode: 'cat-stairs',
      replay: {
        ticks: 360,
        actions: [
          { tick: 30, direction: 'LEFT' },
          { tick: 120, direction: 'RIGHT' },
        ],
      },
    },
    {
      gameCode: 'cat-merge',
      replay: {
        ticks: 360,
        actions: [
          { tick: 30, direction: 'LEFT' },
          { tick: 120, direction: 'RIGHT' },
          { tick: 210, direction: 'UP' },
          { tick: 300, direction: 'DOWN' },
        ],
      },
    },
  ];

  it.each(replays)('$gameCode의 replay body를 변환 없이 전송한다', async ({ gameCode, replay }) => {
    const fetchMock = mockResponse(result);

    await expect(finishMinigameRun(gameCode, 'run-123', replay)).resolves.toEqual(result);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/minigames/${gameCode}/runs/run-123/finish`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(replay) }),
    );
  });

  it.each(gameCodes)('%s의 전체 랭킹과 내 순위를 보존한다', async (gameCode) => {
    const leaderboard: MinigameLeaderboard = {
      items: [
        { rank: 1, userId: 7, nickname: '첫 번째 고양이', score: 900 },
        { rank: 2, userId: 8, nickname: '두 번째 고양이', score: 850 },
      ],
      myEntry: { rank: 12, userId: 42, nickname: '내 고양이', score: 360 },
      totalPlayers: 100,
    };
    const fetchMock = mockResponse(leaderboard);

    await expect(fetchMinigameLeaderboard(gameCode)).resolves.toEqual(leaderboard);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/minigames/${gameCode}/leaderboard`,
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
  });

  it('명시적으로 선택한 이전 버전도 경로에 그대로 전달한다', async () => {
    const fetchMock = mockResponse({ items: [] });
    await fetchMinigames(1);
    await startMinigameRun('room-runner', 1);
    await fetchMinigameLeaderboard('room-runner');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE}/minigames?rulesVersion=1`,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_BASE}/minigames/room-runner/runs?rulesVersion=1`,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${API_BASE}/minigames/room-runner/leaderboard`,
      expect.any(Object),
    );
  });

  it('참여 기록이 없는 랭킹 응답의 null 내 순위를 보존한다', async () => {
    const leaderboard: MinigameLeaderboard = { items: [], myEntry: null, totalPlayers: 0 };
    mockResponse(leaderboard);

    await expect(fetchMinigameLeaderboard('cat-merge')).resolves.toEqual(leaderboard);
  });

  it('시작 경로의 gameCode를 단일 URI 경로 요소로 인코딩한다', async () => {
    const fetchMock = mockResponse({});

    await startMinigameRun('game/ a+b?', 2);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/minigames/game%2F%20a%2Bb%3F/runs?rulesVersion=2`,
      expect.objectContaining({ method: 'POST', body: undefined }),
    );
  });

  it('종료 경로의 gameCode와 runId를 각각 인코딩한다', async () => {
    const fetchMock = mockResponse(result);
    const replay: MinigameReplay = { ticks: 60, jumpTicks: [10] };

    await finishMinigameRun('game/ a+b?', 'run/ c+d?', replay);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/minigames/game%2F%20a%2Bb%3F/runs/run%2F%20c%2Bd%3F/finish`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(replay) }),
    );
  });

  it('랭킹 경로의 gameCode를 단일 URI 경로 요소로 인코딩한다', async () => {
    const fetchMock = mockResponse({ items: [], myEntry: null, totalPlayers: 0 });

    await fetchMinigameLeaderboard('game/ a+b?');

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/minigames/game%2F%20a%2Bb%3F/leaderboard`,
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
  });
});
