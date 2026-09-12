import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSessionUserId } from '@/api/auth';
import {
  fetchMinigames,
  fetchMinigameLeaderboard,
  finishMinigameRun,
  startMinigameRun,
  type Minigame,
  type MinigameReplay,
  type MinigameResult,
  type MinigameRun,
} from '@/api/minigames';
import { useLatestRef } from '@/hooks/use-stable-value';
import { queryKeys } from '@/lib/query-keys';
import { getMinigameDefinition } from '@/constants/minigames';

const NO_GAMES: Minigame[] = [];
const playableGames = (games: Minigame[]) =>
  games.filter((game) => {
    const definition = getMinigameDefinition(game.gameCode);
    return !!definition && definition.rulesVersion === game.rulesVersion;
  });

export function useMinigames(enabled: boolean) {
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: queryKeys.minigames.catalog,
    queryFn: fetchMinigames,
    select: playableGames,
    enabled,
  });
  const retry = useCallback(() => void refetch(), [refetch]);
  const games = data ?? NO_GAMES;
  return useMemo(
    () => ({ games, loading: isFetching, error: isError, retry }),
    [games, isFetching, isError, retry],
  );
}

export function useMinigameLeaderboard(gameCode: string, enabled: boolean) {
  const userId = getSessionUserId();
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: queryKeys.minigames.leaderboard(userId, gameCode),
    queryFn: () => fetchMinigameLeaderboard(gameCode),
    enabled,
  });
  const retry = useCallback(() => void refetch(), [refetch]);
  return useMemo(
    () => ({ leaderboard: data ?? null, loading: isFetching, error: isError, retry }),
    [data, isFetching, isError, retry],
  );
}

type Session = {
  id: string;
  gameCode: string;
  seed: number;
  practice: boolean;
  run: MinigameRun | null;
};
type Submission = { sessionId: string; run: MinigameRun; replay: MinigameReplay };

/** Keep failed replay payloads until an explicit new attempt, so retries are idempotent. */
export function useMinigameRun(gameCode: string) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<MinigameResult | null>(null);
  const [finished, setFinished] = useState(false);
  const [startError, setStartError] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [pending, setPending] = useState(false);
  const sessionRef = useLatestRef(session);
  const ownerRef = useLatestRef(userId);
  const busy = useRef<'start' | 'submit' | null>(null);
  const submission = useRef<Submission | null>(null);
  const practiceCounter = useRef(0);
  const generation = useRef(0);
  const finishedRef = useLatestRef(finished);
  const { mutateAsync: startRequest } = useMutation({ mutationFn: startMinigameRun, retry: false });
  const { mutateAsync: finishRequest } = useMutation({
    mutationFn: ({ run, replay }: Submission) => finishMinigameRun(run.gameCode, run.runId, replay),
    retry: false,
  });

  const begin = useCallback(
    async (practice: boolean) => {
      if (busy.current || (sessionRef.current && !finishedRef.current)) return;
      const definition = getMinigameDefinition(gameCode);
      if (!definition) {
        setStartError(true);
        return;
      }
      busy.current = 'start';
      setPending(true);
      setStartError(false);
      const owner = ownerRef.current;
      const attemptGeneration = ++generation.current;
      try {
        const run = practice ? null : await startRequest(gameCode);
        if (ownerRef.current !== owner || generation.current !== attemptGeneration) return;
        // A newer rules version cannot be replayed by this client.
        if (
          run &&
          (run.gameCode !== gameCode ||
            run.rulesVersion !== definition.rulesVersion ||
            run.maxTicks !== definition.maxTicks ||
            !Number.isInteger(run.seed) ||
            run.seed < 1 ||
            run.seed > 2147483647)
        ) {
          setStartError(true);
          return;
        }
        const next: Session = {
          id: run?.runId ?? `${gameCode}:practice-${++practiceCounter.current}`,
          gameCode,
          seed: run?.seed ?? Math.floor(Math.random() * 2147483646) + 1,
          practice,
          run,
        };
        sessionRef.current = next;
        submission.current = null;
        setSession(next);
        setResult(null);
        finishedRef.current = false;
        setFinished(false);
        setSubmitError(false);
      } catch {
        if (ownerRef.current === owner && generation.current === attemptGeneration)
          setStartError(true);
      } finally {
        if (generation.current === attemptGeneration) {
          busy.current = null;
          setPending(false);
        }
      }
    },
    [finishedRef, gameCode, ownerRef, sessionRef, startRequest],
  );

  const submit = useCallback(
    async (attempt: Submission) => {
      if (busy.current || sessionRef.current?.id !== attempt.sessionId) return;
      busy.current = 'submit';
      setPending(true);
      setSubmitError(false);
      const owner = ownerRef.current;
      try {
        const saved = await finishRequest(attempt);
        if (ownerRef.current !== owner || sessionRef.current?.id !== attempt.sessionId) return;
        setResult(saved);
        submission.current = null;
        void qc.invalidateQueries({
          queryKey: queryKeys.minigames.leaderboard(owner, attempt.run.gameCode),
        });
      } catch {
        if (ownerRef.current === owner && sessionRef.current?.id === attempt.sessionId) {
          setSubmitError(true);
        }
      } finally {
        busy.current = null;
        setPending(false);
      }
    },
    [finishRequest, ownerRef, qc, sessionRef],
  );

  const finish = useCallback(
    (sessionId: string, replay: MinigameReplay) => {
      const current = sessionRef.current;
      if (
        !current ||
        current.id !== sessionId ||
        finishedRef.current ||
        submission.current ||
        busy.current
      )
        return;
      finishedRef.current = true;
      setFinished(true);
      if (current.practice || !current.run) return;
      const attempt = {
        sessionId,
        run: current.run,
        replay:
          'jumpTicks' in replay
            ? { ticks: replay.ticks, jumpTicks: [...replay.jumpTicks] }
            : {
                ticks: replay.ticks,
                actions: replay.actions.map(({ tick, direction }) => ({ tick, direction })),
              },
      };
      submission.current = attempt;
      void submit(attempt);
    },
    [finishedRef, sessionRef, submit],
  );
  const abandonUnfinished = useCallback(() => {
    generation.current += 1;
    if (busy.current === 'start') {
      busy.current = null;
      setPending(false);
    }
    if (finishedRef.current) return;
    sessionRef.current = null;
    setSession(null);
    setStartError(false);
  }, [finishedRef, sessionRef]);
  const retrySubmit = useCallback(() => {
    setStartError(false);
    if (submission.current) void submit(submission.current);
  }, [submit]);
  const start = useCallback(() => void begin(false), [begin]);
  const practice = useCallback(() => void begin(true), [begin]);

  return useMemo(
    () => ({
      session,
      result,
      finished,
      startError,
      submitError,
      pending,
      start,
      practice,
      finish,
      retrySubmit,
      abandonUnfinished,
    }),
    [
      session,
      result,
      finished,
      startError,
      submitError,
      pending,
      start,
      practice,
      finish,
      retrySubmit,
      abandonUnfinished,
    ],
  );
}
