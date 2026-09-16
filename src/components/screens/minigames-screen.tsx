import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { Minigame } from '@/api/minigames';
import { CharacterAvatar } from '@/components/room/character-avatar';
import { MinigameLayout } from '@/components/screens/minigame-layout';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { RetryState } from '@/components/ui/retry-state';
import { getMinigameDefinition } from '@/constants/minigames';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type MinigamesScreenProps = {
  games?: Minigame[];
  practiceGames?: Minigame[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onSelectGame?: (gameCode: string) => void;
  onLeaderboard?: (gameCode: string) => void;
  onPractice?: (gameCode: string) => void;
  onBack?: () => void;
};

export function MinigamesScreen({
  games = [],
  practiceGames = [],
  loading,
  error,
  onRetry,
  onSelectGame,
  onLeaderboard,
  onPractice,
  onBack,
}: MinigamesScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const availablePracticeGames = error
    ? practiceGames
    : practiceGames.filter((game) => !games.some((ranked) => ranked.gameCode === game.gameCode));
  const showPractice = !loading && !!onPractice && availablePracticeGames.length > 0;
  const renderGameCard = (game: Minigame, practice = false) => {
    const definition = getMinigameDefinition(game.gameCode);
    return (
      <GlassSurface
        key={game.gameCode}
        interactive={false}
        glassEffectStyle="clear"
        // 안드로이드에서 반투명 카드의 elevation 그림자가 회색 테두리처럼 보였다 (#1328).
        lift={false}
        fallbackColor={t.surface}
        style={styles.card}>
        <View style={styles.scene}>
          <View style={styles.thumbnail}>
            <CharacterAvatar characterId="cat" pose={definition?.pose ?? 1} size={Spacing.six} />
          </View>
          <View style={styles.sceneCopy}>
            <Text style={[Typography.h3, { color: t.text }]}>{game.name}</Text>
          </View>
        </View>
        {practice ? (
          <Button
            glass
            label={tr('roomShop.minigame.practice')}
            accessibilityLabel={tr('roomShop.minigame.practiceA11y', { name: game.name })}
            variant="secondary"
            onPress={() => onPractice?.(game.gameCode)}
          />
        ) : (
          <View style={styles.actions}>
            <Button
              glass
              label={tr('roomShop.minigame.start')}
              accessibilityLabel={tr('roomShop.minigame.startA11y', { name: game.name })}
              style={styles.action}
              onPress={() => onSelectGame?.(game.gameCode)}
            />
            <Button
              glass
              label={tr('roomShop.minigame.ranking')}
              accessibilityLabel={tr('roomShop.minigame.rankingA11y', { name: game.name })}
              variant="secondary"
              style={styles.action}
              onPress={() => onLeaderboard?.(game.gameCode)}
            />
          </View>
        )}
      </GlassSurface>
    );
  };
  return (
    <MinigameLayout title={tr('roomShop.minigame.title')} onBack={onBack}>
      {loading ? (
        <ActivityIndicator
          color={t.primaryText}
          accessibilityLabel={tr('roomShop.minigame.loading')}
        />
      ) : null}
      {error ? <RetryState message={tr('roomShop.minigame.listError')} onRetry={onRetry} /> : null}
      {!loading && !error && games.length === 0 ? (
        <Text style={[Typography.body, { color: t.textMuted }]}>
          {tr('roomShop.minigame.empty')}
        </Text>
      ) : null}
      {!error ? games.map((game) => renderGameCard(game)) : null}
      {showPractice ? (
        <View style={styles.practiceSection}>
          <Text accessibilityRole="header" style={[Typography.h3, { color: t.text }]}>
            {tr('roomShop.minigame.practiceSection')}
          </Text>
          {availablePracticeGames.map((game) => renderGameCard(game, true))}
        </View>
      ) : null}
    </MinigameLayout>
  );
}

const styles = StyleSheet.create({
  practiceSection: { gap: Spacing.three },
  card: { padding: Spacing.three, gap: Spacing.two, borderRadius: Radius.xl },
  scene: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  thumbnail: { borderRadius: Radius.lg, overflow: 'hidden' },
  sceneCopy: { flex: 1, gap: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
