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
        fallbackColor={t.surface}
        style={styles.card}>
        <View style={styles.scene}>
          <View style={styles.thumbnail}>
            <CharacterAvatar characterId="cat" pose={definition?.pose ?? 1} size={Spacing.six} />
          </View>
          <View style={styles.sceneCopy}>
            <Text style={[Typography.h3, { color: t.text }]}>{game.name}</Text>
            {definition ? (
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {definition.tagline}
              </Text>
            ) : null}
          </View>
        </View>
        {practice ? (
          <Button
            glass
            label={`${game.name} 연습하기 · 랭킹 미기록`}
            variant="secondary"
            onPress={() => onPractice?.(game.gameCode)}
          />
        ) : (
          <View style={styles.actions}>
            <Button
              glass
              label="시작"
              accessibilityLabel={`${game.name} 시작`}
              style={styles.action}
              onPress={() => onSelectGame?.(game.gameCode)}
            />
            <Button
              glass
              label="랭킹"
              accessibilityLabel={`${game.name} 랭킹`}
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
    <MinigameLayout title="미니게임" onBack={onBack}>
      {loading ? (
        <ActivityIndicator color={t.primaryText} accessibilityLabel="게임 불러오는 중" />
      ) : null}
      {error ? (
        <RetryState
          message="게임 목록을 불러오지 못했어요"
          detail="연결을 확인하고 다시 시도해주세요. 연습은 기록 없이 즐길 수 있어요."
          onRetry={onRetry}
        />
      ) : null}
      {!loading && !error && games.length === 0 ? (
        <Text style={[Typography.body, { color: t.textMuted }]}>지금은 등록된 게임이 없어요.</Text>
      ) : null}
      {!error ? games.map((game) => renderGameCard(game)) : null}
      {showPractice ? (
        <View style={styles.practiceSection}>
          <Text accessibilityRole="header" style={[Typography.h3, { color: t.text }]}>
            연습 게임 · 랭킹 미기록
          </Text>
          <Text style={[Typography.body, { color: t.textMuted }]}>
            연결 없이도 즐길 수 있어요. 연습 기록은 저장되지 않아요.
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
