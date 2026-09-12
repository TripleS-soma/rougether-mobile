import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Minigame } from '@/api/minigames';
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
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export const MINIGAME_PREVIEW_CATALOG: Minigame[] = PLAYABLE_MINIGAMES.map(
  ({ gameCode, name, description, rulesVersion }) => ({
    gameCode,
    name,
    description,
    rulesVersion,
  }),
);

/** Isolated dev fixture. All play is practice; no API or real ranking writes. */
export function MinigamePreview({ initialGameCode }: { initialGameCode?: MinigameCode }) {
  const [page, setPage] = useState<'hub' | 'game' | 'ranking'>(initialGameCode ? 'game' : 'hub');
  const [gameCode, setGameCode] = useState<MinigameCode>(initialGameCode ?? 'room-runner');
  const [attempt, setAttempt] = useState(0);
  const [finished, setFinished] = useState(false);
  const definition = MINIGAME_DEFINITIONS[gameCode];
  const t = useTokens();
  const Typography = useTypography();
  const replay = () => {
    setAttempt((value) => value + 1);
    setFinished(false);
  };
  const select = (code: string, nextPage: 'game' | 'ranking') => {
    const game = getMinigameDefinition(code);
    if (!game) return;
    setGameCode(game.gameCode);
    setPage(nextPage);
    setFinished(false);
    setAttempt(0);
  };
  return (
    <View style={styles.root}>
      <Text
        style={[
          Typography.supporting,
          styles.notice,
          { color: t.textMuted, backgroundColor: t.surfaceMuted },
        ]}>
        개발 미리보기 · 연습 전용 · 실제 랭킹 미연결
      </Text>
      {page === 'hub' ? (
        <MinigamesScreen
          games={MINIGAME_PREVIEW_CATALOG}
          onSelectGame={(code) => select(code, 'game')}
          onLeaderboard={(code) => select(code, 'ranking')}
        />
      ) : page === 'ranking' ? (
        <MinigameLeaderboardScreen
          gameName={definition.name}
          leaderboard={{ items: [], myEntry: null, totalPlayers: 0 }}
          onBack={() => setPage('hub')}
        />
      ) : (
        <MinigameRunnerScreen
          practice
          finished={finished}
          gameName={definition.name}
          instructions={definition.instructions}
          characterPose={definition.pose}
          game={
            attempt ? (
              <MinigamePlayer
                key={`${gameCode}-${attempt}`}
                gameCode={gameCode}
                seed={42}
                practice
                active={!finished}
                onFinish={() => setFinished(true)}
              />
            ) : undefined
          }
          onPractice={replay}
          onLeaderboard={() => setPage('ranking')}
          onBack={() => setPage('hub')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: Spacing.six * 10, width: '100%' },
  notice: { textAlign: 'center', padding: Spacing.two },
});
