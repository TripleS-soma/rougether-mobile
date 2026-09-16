import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { MinigameLeaderboard, MinigameRankingEntry } from '@/api/minigames';
import { MinigameLayout } from '@/components/screens/minigame-layout';
import { GlassSurface } from '@/components/ui/glass-surface';
import { RetryState } from '@/components/ui/retry-state';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type MinigameLeaderboardScreenProps = {
  gameName?: string;
  leaderboard?: MinigameLeaderboard | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onBack?: () => void;
};

function RankingRow({ entry, mine = false }: { entry: MinigameRankingEntry; mine?: boolean }) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  return (
    <View
      accessibilityLabel={tr(
        mine
          ? 'roomShop.minigame.leaderboard.rowMineA11y'
          : 'roomShop.minigame.leaderboard.rowA11y',
        { rank: entry.rank, nickname: entry.nickname, score: entry.score },
      )}
      style={[styles.row, { borderColor: t.border }]}>
      <Text style={[Typography.label, { color: t.primaryText }]}>
        {tr('roomShop.minigame.leaderboard.rank', { rank: entry.rank })}
      </Text>
      <Text numberOfLines={1} style={[Typography.body, styles.name, { color: t.text }]}>
        {entry.nickname}
        {mine ? tr('roomShop.minigame.leaderboard.meSuffix') : ''}
      </Text>
      <Text style={[Typography.label, { color: t.text }]}>
        {tr('roomShop.minigame.leaderboard.score', { score: entry.score.toLocaleString() })}
      </Text>
    </View>
  );
}

export function MinigameLeaderboardScreen({
  gameName,
  leaderboard = null,
  loading,
  error,
  onRetry,
  onBack,
}: MinigameLeaderboardScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  return (
    <MinigameLayout title={tr('roomShop.minigame.ranking')} onBack={onBack}>
      <View style={styles.section}>
        <Text style={[Typography.h2, { color: t.text }]}>
          {gameName ?? tr('roomShop.minigame.runner.name')}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator
          color={t.primaryText}
          accessibilityLabel={tr('roomShop.minigame.leaderboard.loading')}
        />
      ) : null}
      {error ? (
        <RetryState message={tr('roomShop.minigame.leaderboard.error')} onRetry={onRetry} />
      ) : null}
      {leaderboard ? (
        <>
          <GlassSurface
            interactive={false}
            glassEffectStyle="clear"
            fallbackColor={t.surface}
            style={styles.card}>
            <Text style={[Typography.h3, { color: t.text }]}>
              {tr('roomShop.minigame.leaderboard.myBest')}
            </Text>
            {leaderboard.myEntry ? (
              <RankingRow entry={leaderboard.myEntry} mine />
            ) : (
              <Text style={[Typography.body, { color: t.textMuted }]}>
                {tr('roomShop.minigame.leaderboard.noRecord')}
              </Text>
            )}
          </GlassSurface>
          <Text style={[Typography.label, { color: t.textMuted }]}>
            {tr('roomShop.minigame.leaderboard.players', {
              n: leaderboard.totalPlayers.toLocaleString(),
            })}
          </Text>
          {leaderboard.items.length ? (
            <GlassSurface
              interactive={false}
              glassEffectStyle="clear"
              fallbackColor={t.surface}
              style={styles.card}>
              {leaderboard.items.map((entry) => (
                <RankingRow
                  key={entry.userId}
                  entry={entry}
                  mine={entry.userId === leaderboard.myEntry?.userId}
                />
              ))}
            </GlassSurface>
          ) : null}
        </>
      ) : null}
      {!loading && !error && onRetry ? (
        <Button
          glass
          label={tr('roomShop.minigame.leaderboard.refresh')}
          accessibilityLabel={tr('roomShop.minigame.leaderboard.refreshA11y')}
          onPress={onRetry}
          variant="secondary"
        />
      ) : null}
    </MinigameLayout>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  card: { padding: Spacing.three, gap: Spacing.two, borderRadius: Radius.xl },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1 },
});
