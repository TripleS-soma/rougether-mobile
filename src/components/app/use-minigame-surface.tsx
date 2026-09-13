import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { MinigameReplay } from '@/api/minigames';
import type { Screen } from '@/components/app/navigation';
import { MinigamePlayer } from '@/components/app/minigame-player';
import { MinigamesScreen } from '@/components/screens/minigames-screen';
import { MinigameRunnerScreen } from '@/components/screens/minigame-runner-screen';
import { MinigameLeaderboardScreen } from '@/components/screens/minigame-leaderboard-screen';
import {
  MINIGAME_DEFINITIONS,
  PLAYABLE_MINIGAMES,
  getMinigameDefinition,
  type MinigameCode,
} from '@/constants/minigames';
import { useLatestRef } from '@/hooks/use-stable-value';
import { useMinigames, useMinigameLeaderboard, useMinigameRun } from '@/hooks/use-minigames';
import { track } from '@/lib/analytics';

// Retained transition nodes must match the current session, not just the game screen.
export const MinigameActiveContext = createContext<string | null>(null);

function ActiveMinigame({
  gameCode,
  sessionId,
  seed,
  practice,
  finished,
  onFinish,
}: {
  gameCode: MinigameCode;
  sessionId: string;
  seed: number;
  practice: boolean;
  finished: boolean;
  onFinish: (replay: MinigameReplay) => void;
}) {
  const activeSessionId = useContext(MinigameActiveContext);
  return (
    <MinigamePlayer
      gameCode={gameCode}
      seed={seed}
      practice={practice}
      active={activeSessionId === sessionId && !finished}
      onFinish={onFinish}
    />
  );
}

export function useMinigameSurface({
  screen,
  setScreen,
}: {
  screen: Screen;
  setScreen: Dispatch<SetStateAction<Screen>>;
}) {
  const [gameCode, setGameCode] = useState<MinigameCode>('room-runner');
  const definition = MINIGAME_DEFINITIONS[gameCode];
  const catalog = useMinigames(screen === 'minigames');
  const ranking = useMinigameLeaderboard(gameCode, screen === 'minigameLeaderboard');
  // Independent sessions preserve failed submissions when the user visits another game.
  const runner = useMinigameRun('room-runner');
  const stairs = useMinigameRun('cat-stairs');
  const merge = useMinigameRun('cat-merge');
  const runs = { 'room-runner': runner, 'cat-stairs': stairs, 'cat-merge': merge };
  const runsRef = useLatestRef(runs);
  const run = runs[gameCode];
  const { abandonUnfinished, finish, session } = run;
  const previous = useRef({ screen, gameCode, abandonUnfinished });
  useEffect(() => {
    if (
      previous.current.screen === 'minigameRunner' &&
      (screen !== 'minigameRunner' || previous.current.gameCode !== gameCode)
    ) {
      previous.current.abandonUnfinished();
    }
    previous.current = { screen, gameCode, abandonUnfinished };
  }, [screen, gameCode, abandonUnfinished]);
  const openMinigames = useCallback(() => setScreen('minigames'), [setScreen]);
  const openGame = useCallback(
    (code: string) => {
      const next = getMinigameDefinition(code);
      if (!next) return;
      setGameCode(next.gameCode);
      setScreen('minigameRunner');
    },
    [setScreen],
  );
  const openLeaderboard = useCallback(
    (code: string, via: 'picker' | 'result' = 'picker') => {
      const next = getMinigameDefinition(code);
      if (!next) return;
      track('minigame_leaderboard_view', { game: next.gameCode, via });
      setGameCode(next.gameCode);
      setScreen('minigameLeaderboard');
    },
    [setScreen],
  );
  const openPractice = useCallback(
    (code: string) => {
      const next = getMinigameDefinition(code);
      if (!next) return;
      runsRef.current[next.gameCode].practice();
      setGameCode(next.gameCode);
      setScreen('minigameRunner');
    },
    [runsRef, setScreen],
  );
  const onFinish = useCallback(
    (replay: MinigameReplay) => {
      if (session) finish(session.id, replay);
    },
    [finish, session],
  );
  const activeSessionId = session?.id ?? null;

  const subScreen =
    screen === 'minigames' ? (
      <MinigamesScreen
        {...catalog}
        practiceGames={PLAYABLE_MINIGAMES}
        onRetry={catalog.retry}
        onSelectGame={openGame}
        onLeaderboard={openLeaderboard}
        onPractice={openPractice}
        onBack={() => setScreen('myRoom')}
      />
    ) : screen === 'minigameRunner' ? (
      <MinigameRunnerScreen
        {...run}
        gameName={definition.name}
        instructions={definition.instructions}
        characterPose={definition.pose}
        practice={session?.practice}
        game={
          session ? (
            <ActiveMinigame
              key={session.id}
              gameCode={gameCode}
              sessionId={session.id}
              seed={session.seed}
              practice={session.practice}
              finished={run.finished}
              onFinish={onFinish}
            />
          ) : undefined
        }
        onStart={run.start}
        onPractice={run.practice}
        onRetrySubmit={run.retrySubmit}
        onLeaderboard={() => openLeaderboard(gameCode, 'result')}
        onBack={openMinigames}
      />
    ) : screen === 'minigameLeaderboard' ? (
      <MinigameLeaderboardScreen
        {...ranking}
        gameName={definition.name}
        onRetry={ranking.retry}
        onBack={openMinigames}
      />
    ) : null;
  return { openMinigames, subScreen, activeSessionId };
}
