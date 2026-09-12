import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  fetchMinigameLeaderboard,
  fetchMinigames,
  finishMinigameRun,
  startMinigameRun,
  type Minigame,
  type MinigameAction,
  type MinigameLeaderboard,
  type MinigameResult,
  type MinigameRun,
} from '@/api/minigames';
import { useMinigameLeaderboard, useMinigameRun, useMinigames } from '@/hooks/use-minigames';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/auth', () => ({ getSessionUserId: () => 7 }));
jest.mock('@/api/minigames', () => ({
  fetchMinigames: jest.fn(),
  fetchMinigameLeaderboard: jest.fn(),
  startMinigameRun: jest.fn(),
  finishMinigameRun: jest.fn(),
}));

const catalogRequest = jest.mocked(fetchMinigames);
const leaderboardRequest = jest.mocked(fetchMinigameLeaderboard);
const startRequest = jest.mocked(startMinigameRun);
const finishRequest = jest.mocked(finishMinigameRun);
const clients: ReturnType<typeof createTestQueryClient>[] = [];

function minigameQueryWrapper() {
  const client = createTestQueryClient();
  // MutationCache.clear does not cancel GC timers; keep this suite timer-free.
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { retry: false, gcTime: Infinity },
  });
  clients.push(client);
  return queryWrapper(client);
}
const GAME: Minigame = {
  gameCode: 'room-runner',
  name: '룸 러너',
  description: '장애물을 뛰어넘어요',
  rulesVersion: 1,
};
const STAIRS_GAME: Minigame = {
  gameCode: 'cat-stairs',
  name: '고양이 계단',
  description: '다음 계단 방향에 맞춰 올라가요',
  rulesVersion: 1,
};
const MERGE_GAME: Minigame = {
  gameCode: 'cat-merge',
  name: '고양이 합치기',
  description: '같은 숫자 타일을 합쳐요',
  rulesVersion: 1,
};
const RUN: MinigameRun = {
  runId: 'server-run-42',
  gameCode: GAME.gameCode,
  rulesVersion: 1,
  seed: 12345,
  maxTicks: 18000,
  expiresAt: '2026-09-12T12:00:00Z',
};
const SAVED: MinigameResult = {
  runId: RUN.runId,
  score: 73,
  bestScore: 92,
  personalBest: false,
  rank: 8,
};
const EMPTY_LEADERBOARD: MinigameLeaderboard = {
  items: [],
  myEntry: null,
  totalPlayers: 0,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.resetAllMocks();
  catalogRequest.mockResolvedValue([GAME]);
  leaderboardRequest.mockResolvedValue(EMPTY_LEADERBOARD);
  startRequest.mockResolvedValue(RUN);
  finishRequest.mockResolvedValue(SAVED);
});

afterEach(() => {
  for (const client of clients) client.clear();
  clients.length = 0;
});

async function renderRun(gameCode = GAME.gameCode) {
  return renderHook(() => useMinigameRun(gameCode), { wrapper: minigameQueryWrapper() });
}

async function renderStartedRun(run = RUN) {
  const hook = await renderRun(run.gameCode);
  await act(() => hook.result.current.start());
  await waitFor(() => expect(hook.result.current.session?.id).toBe(run.runId));
  return hook;
}

describe('minigame queries', () => {
  it('does not fetch a disabled catalog and loads it when the hub opens', async () => {
    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useMinigames(enabled),
      {
        wrapper: minigameQueryWrapper(),
        initialProps: { enabled: false },
      },
    );
    expect(catalogRequest).not.toHaveBeenCalled();
    expect(result.current.games).toEqual([]);
    expect(result.current.loading).toBe(false);

    await rerender({ enabled: true });
    await waitFor(() => expect(result.current.games).toEqual([GAME]));
    expect(catalogRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps supported runner rules and filters unknown games', async () => {
    catalogRequest.mockResolvedValue([
      GAME,
      { ...GAME, rulesVersion: 2 },
      { ...GAME, gameCode: 'another-game' },
    ]);
    const { result } = await renderHook(() => useMinigames(true), {
      wrapper: minigameQueryWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.games).toEqual([GAME]);
  });

  it('offers all three installed games while filtering unsupported games and rules versions', async () => {
    const supported = [MERGE_GAME, GAME, STAIRS_GAME];
    catalogRequest.mockResolvedValue([
      ...supported,
      ...supported.map((game) => ({ ...game, rulesVersion: 2 })),
      { ...STAIRS_GAME, rulesVersion: 0 },
      { ...GAME, gameCode: 'another-game' },
    ]);
    const { result } = await renderHook(() => useMinigames(true), {
      wrapper: minigameQueryWrapper(),
    });

    await waitFor(() => expect(result.current.games).toEqual(supported));
    expect(result.current.error).toBe(false);
  });

  it('distinguishes an empty leaderboard from a request failure and retries a failure', async () => {
    leaderboardRequest.mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useMinigameLeaderboard(GAME.gameCode, true), {
      wrapper: minigameQueryWrapper(),
    });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.leaderboard).toBeNull();
    expect(result.current.loading).toBe(false);

    await act(() => result.current.retry());
    await waitFor(() => expect(result.current.leaderboard).toEqual(EMPTY_LEADERBOARD));
    expect(result.current.error).toBe(false);
    expect(leaderboardRequest).toHaveBeenCalledTimes(2);
    expect(leaderboardRequest).toHaveBeenLastCalledWith(GAME.gameCode);
  });
});

describe('minigame runs', () => {
  it('starts with the server seed and displays the authoritative score and ranking after finish', async () => {
    const { result } = await renderStartedRun();
    expect(startRequest.mock.calls[0][0]).toBe(GAME.gameCode);
    expect(result.current.session).toEqual({
      id: RUN.runId,
      gameCode: GAME.gameCode,
      seed: RUN.seed,
      practice: false,
      run: RUN,
    });
    expect(result.current.result).toBeNull();

    await act(() => result.current.finish(RUN.runId, { ticks: 120, jumpTicks: [20, 80] }));
    await waitFor(() => expect(result.current.result).toEqual(SAVED));
    expect(finishRequest).toHaveBeenCalledWith(GAME.gameCode, RUN.runId, {
      ticks: 120,
      jumpTicks: [20, 80],
    });
    expect(result.current.finished).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.submitError).toBe(false);
  });

  it.each([
    { gameCode: 'cat-stairs', maxTicks: 7200 },
    { gameCode: 'cat-merge', maxTicks: 18000 },
  ])('starts $gameCode with its own server tick limit', async ({ gameCode, maxTicks }) => {
    const run = { ...RUN, runId: `${gameCode}-run`, gameCode, maxTicks };
    startRequest.mockResolvedValue(run);
    const { result } = await renderStartedRun(run);

    expect(startRequest.mock.calls[0][0]).toBe(gameCode);
    expect(result.current.session).toEqual({
      id: run.runId,
      gameCode,
      seed: run.seed,
      practice: false,
      run,
    });
    expect(result.current.startError).toBe(false);
    expect(result.current.pending).toBe(false);
  });

  it('rejects a server session for another game even when its rules and tick limit match', async () => {
    startRequest.mockResolvedValue(RUN);
    const { result } = await renderRun(MERGE_GAME.gameCode);

    await act(() => result.current.start());
    await waitFor(() => expect(result.current.startError).toBe(true));

    expect(startRequest.mock.calls[0][0]).toBe(MERGE_GAME.gameCode);
    expect(result.current.session).toBeNull();
    expect(result.current.pending).toBe(false);
    expect(finishRequest).not.toHaveBeenCalled();
  });

  it.each([
    { gameCode: 'cat-stairs', maxTicks: 18000, rulesVersion: 1, mismatch: 'tick limit' },
    { gameCode: 'cat-merge', maxTicks: 18000, rulesVersion: 2, mismatch: 'rules version' },
  ])(
    'rejects a mismatched $mismatch for $gameCode',
    async ({ gameCode, maxTicks, rulesVersion }) => {
      startRequest.mockResolvedValue({ ...RUN, gameCode, maxTicks, rulesVersion });
      const { result } = await renderRun(gameCode);

      await act(() => result.current.start());
      await waitFor(() => expect(result.current.startError).toBe(true));

      expect(result.current.session).toBeNull();
      expect(result.current.pending).toBe(false);
      expect(finishRequest).not.toHaveBeenCalled();
    },
  );

  it('retries a failed finish with the same run and an immutable copy of the original replay', async () => {
    finishRequest.mockRejectedValueOnce(new Error('response lost'));
    const { result } = await renderStartedRun();
    const replay = { ticks: 120, jumpTicks: [20, 80] };
    await act(() => result.current.finish(RUN.runId, replay));
    await waitFor(() => expect(result.current.submitError).toBe(true));
    expect(result.current.result).toBeNull();

    replay.ticks = 999;
    replay.jumpTicks.push(90);
    await act(() => result.current.retrySubmit());
    await waitFor(() => expect(result.current.result).toEqual(SAVED));
    expect(startRequest).toHaveBeenCalledTimes(1);
    expect(finishRequest).toHaveBeenCalledTimes(2);
    expect(finishRequest.mock.calls[0]).toEqual([
      GAME.gameCode,
      RUN.runId,
      { ticks: 120, jumpTicks: [20, 80] },
    ]);
    expect(finishRequest.mock.calls[1]).toEqual(finishRequest.mock.calls[0]);
    expect(result.current.submitError).toBe(false);
  });

  it.each<{ gameCode: string; maxTicks: number; actions: MinigameAction[] }>([
    {
      gameCode: 'cat-stairs',
      maxTicks: 7200,
      actions: [
        { tick: 20, direction: 'LEFT' },
        { tick: 80, direction: 'RIGHT' },
      ],
    },
    {
      gameCode: 'cat-merge',
      maxTicks: 18000,
      actions: [
        { tick: 20, direction: 'UP' },
        { tick: 40, direction: 'LEFT' },
        { tick: 60, direction: 'DOWN' },
        { tick: 80, direction: 'RIGHT' },
      ],
    },
  ])(
    'retries $gameCode with deeply copied actions and never submits a client score',
    async ({ gameCode, maxTicks, actions }) => {
      const run = { ...RUN, runId: `${gameCode}-run`, gameCode, maxTicks };
      const saved = { ...SAVED, runId: run.runId };
      startRequest.mockResolvedValue(run);
      finishRequest.mockRejectedValueOnce(new Error('response lost')).mockResolvedValue(saved);
      const { result } = await renderStartedRun(run);
      const replay = {
        ticks: 120,
        actions: actions.map((action) => ({ ...action })),
        score: 999999,
      };
      const expectedReplay = { ticks: 120, actions };

      await act(() => result.current.finish(run.runId, replay));
      await waitFor(() => expect(result.current.submitError).toBe(true));
      expect(result.current.result).toBeNull();

      replay.ticks = 999;
      replay.actions[0].tick = 999;
      replay.actions[0].direction = 'RIGHT';
      replay.actions.push({ tick: 100, direction: 'LEFT' });
      replay.score = 1;

      await act(() => result.current.retrySubmit());
      await waitFor(() => expect(result.current.result).toEqual(saved));

      expect(startRequest).toHaveBeenCalledTimes(1);
      expect(finishRequest).toHaveBeenCalledTimes(2);
      expect(finishRequest.mock.calls[0]).toEqual([gameCode, run.runId, expectedReplay]);
      expect(finishRequest.mock.calls[1]).toEqual([gameCode, run.runId, expectedReplay]);
      expect(result.current.submitError).toBe(false);
    },
  );

  it('blocks duplicate starts and practice taps before React re-renders while start is pending', async () => {
    const starting = deferred<MinigameRun>();
    startRequest.mockReturnValueOnce(starting.promise);
    const { result } = await renderRun();
    await act(() => {
      result.current.start();
      result.current.start();
      result.current.practice();
    });
    await waitFor(() => expect(startRequest).toHaveBeenCalledTimes(1));
    expect(result.current.pending).toBe(true);
    expect(result.current.session).toBeNull();

    await act(async () => starting.resolve(RUN));
    await waitFor(() => expect(result.current.session?.id).toBe(RUN.runId));
    expect(result.current.pending).toBe(false);
  });

  it('blocks duplicate finish and retry taps while score submission is pending', async () => {
    const saving = deferred<MinigameResult>();
    finishRequest.mockReturnValueOnce(saving.promise);
    const { result } = await renderStartedRun();
    await act(() => {
      result.current.finish(RUN.runId, { ticks: 120, jumpTicks: [20, 80] });
      result.current.finish(RUN.runId, { ticks: 999, jumpTicks: [] });
      result.current.retrySubmit();
      result.current.start();
    });
    await waitFor(() => expect(finishRequest).toHaveBeenCalledTimes(1));
    expect(result.current.pending).toBe(true);
    expect(startRequest).toHaveBeenCalledTimes(1);

    await act(async () => saving.resolve(SAVED));
    await waitFor(() => expect(result.current.result).toEqual(SAVED));
    expect(result.current.pending).toBe(false);
  });

  it('discards a late start response after leaving the unfinished game', async () => {
    const starting = deferred<MinigameRun>();
    startRequest.mockReturnValueOnce(starting.promise);
    const { result } = await renderRun();
    await act(() => result.current.start());
    await waitFor(() => expect(startRequest).toHaveBeenCalledTimes(1));
    await act(() => result.current.abandonUnfinished());
    await act(async () => starting.resolve(RUN));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.startError).toBe(false);
  });

  it('discards a late start failure after leaving the unfinished game', async () => {
    const starting = deferred<MinigameRun>();
    startRequest.mockReturnValueOnce(starting.promise);
    const { result } = await renderRun();
    await act(() => result.current.start());
    await waitFor(() => expect(startRequest).toHaveBeenCalledTimes(1));
    await act(() => result.current.abandonUnfinished());
    await act(async () => starting.reject(new Error('offline')));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.startError).toBe(false);
  });

  it('preserves a finished game and its failed submission when navigating away', async () => {
    finishRequest.mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderStartedRun();
    await act(() => result.current.finish(RUN.runId, { ticks: 120, jumpTicks: [20, 80] }));
    await waitFor(() => expect(result.current.submitError).toBe(true));
    await act(() => result.current.abandonUnfinished());
    expect(result.current.session?.id).toBe(RUN.runId);
    expect(result.current.finished).toBe(true);
    expect(result.current.submitError).toBe(true);

    await act(() => result.current.retrySubmit());
    await waitFor(() => expect(result.current.result).toEqual(SAVED));
    expect(startRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps the saved result when a new start resolves after leaving the results screen', async () => {
    const { result } = await renderStartedRun();
    await act(() => result.current.finish(RUN.runId, { ticks: 120, jumpTicks: [20, 80] }));
    await waitFor(() => expect(result.current.result).toEqual(SAVED));

    const restarting = deferred<MinigameRun>();
    startRequest.mockReturnValueOnce(restarting.promise);
    await act(() => result.current.start());
    await waitFor(() => expect(startRequest).toHaveBeenCalledTimes(2));
    expect(result.current.pending).toBe(true);
    await act(() => result.current.abandonUnfinished());
    await act(async () => restarting.resolve({ ...RUN, runId: 'server-run-43', seed: 9876 }));
    await waitFor(() => expect(result.current.pending).toBe(false));

    expect(result.current.session?.id).toBe(RUN.runId);
    expect(result.current.finished).toBe(true);
    expect(result.current.result).toEqual(SAVED);
    expect(result.current.submitError).toBe(false);
    expect(finishRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps the failed replay retryable when a new start resolves after leaving the results screen', async () => {
    finishRequest.mockRejectedValueOnce(new Error('response lost'));
    const { result } = await renderStartedRun();
    const replay = { ticks: 120, jumpTicks: [20, 80] };
    await act(() => result.current.finish(RUN.runId, replay));
    await waitFor(() => expect(result.current.submitError).toBe(true));

    const restarting = deferred<MinigameRun>();
    startRequest.mockReturnValueOnce(restarting.promise);
    await act(() => result.current.start());
    await waitFor(() => expect(startRequest).toHaveBeenCalledTimes(2));
    expect(result.current.pending).toBe(true);
    await act(() => result.current.abandonUnfinished());
    await act(async () => restarting.resolve({ ...RUN, runId: 'server-run-43', seed: 9876 }));
    await waitFor(() => expect(result.current.pending).toBe(false));

    expect(result.current.session?.id).toBe(RUN.runId);
    expect(result.current.finished).toBe(true);
    expect(result.current.submitError).toBe(true);
    expect(result.current.result).toBeNull();
    await act(() => result.current.retrySubmit());
    await waitFor(() => expect(result.current.result).toEqual(SAVED));
    expect(finishRequest).toHaveBeenCalledTimes(2);
    expect(finishRequest.mock.calls[1]).toEqual([GAME.gameCode, RUN.runId, replay]);
  });
});
