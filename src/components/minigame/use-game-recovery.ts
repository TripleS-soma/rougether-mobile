import { useCallback, useLayoutEffect, useId, useRef, useState } from 'react';

export type GameError = 'finish' | 'load';

/** A local retry restarts the same seed with a fresh message channel. */
export function useGameRecovery(game: string, seed: number, practice: boolean) {
  const instanceId = useId();
  const [attempt, setAttempt] = useState(0);
  const channelId = `${instanceId}-${game}-${seed}-${practice}-${attempt}`;
  const finished = useRef(false);
  const currentChannel = useRef<string | null>(channelId);
  const [failure, setFailure] = useState<{ channelId: string; error: GameError } | null>(null);
  const error = failure?.channelId === channelId ? failure.error : null;

  useLayoutEffect(() => {
    currentChannel.current = channelId;
    finished.current = false;
    return () => {
      currentChannel.current = null;
    };
  }, [channelId]);

  const isCurrentChannel = useCallback(
    (candidate: string) => currentChannel.current === candidate,
    [],
  );

  const fail = useCallback(
    (reason: GameError) => {
      if (currentChannel.current !== channelId || finished.current) return;
      finished.current = true;
      setFailure({ channelId, error: reason });
    },
    [channelId],
  );
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { channelId, finished, error, fail, retry, isCurrentChannel };
}
