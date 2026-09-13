import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { MinigameLeaderboard, MinigameRankingEntry } from '@/api/minigames';
import { MinigameLayout } from '@/components/screens/minigame-layout';
import { GlassSurface } from '@/components/ui/glass-surface';
import { RetryState } from '@/components/ui/retry-state';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

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
  return (
    <View
      accessibilityLabel={`${entry.rank}위 ${entry.nickname}${mine ? ' 나' : ''} ${entry.score}점`}
      style={[styles.row, { borderColor: t.border }]}>
      <Text style={[Typography.label, { color: t.primaryText }]}>{entry.rank}위</Text>
      <Text numberOfLines={1} style={[Typography.body, styles.name, { color: t.text }]}>
        {entry.nickname}
        {mine ? ' · 나' : ''}
      </Text>
      <Text style={[Typography.label, { color: t.text }]}>{entry.score.toLocaleString()}점</Text>
    </View>
  );
}

export function MinigameLeaderboardScreen({
  gameName = '루틴 러너',
  leaderboard = null,
  loading,
  error,
  onRetry,
  onBack,
}: MinigameLeaderboardScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <MinigameLayout title="랭킹" onBack={onBack}>
      <View style={styles.section}>
        <Text style={[Typography.h2, { color: t.text }]}>{gameName}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={t.primaryText} accessibilityLabel="랭킹 불러오는 중" />
      ) : null}
      {error ? <RetryState message="랭킹을 불러오지 못했어요" onRetry={onRetry} /> : null}
      {leaderboard ? (
        <>
          <GlassSurface
            interactive={false}
            glassEffectStyle="clear"
            fallbackColor={t.surface}
            style={styles.card}>
            <Text style={[Typography.h3, { color: t.text }]}>내 최고 기록</Text>
            {leaderboard.myEntry ? (
              <RankingRow entry={leaderboard.myEntry} mine />
            ) : (
              <Text style={[Typography.body, { color: t.textMuted }]}>기록 없음</Text>
            )}
          </GlassSurface>
          <Text style={[Typography.label, { color: t.textMuted }]}>
            총 {leaderboard.totalPlayers.toLocaleString()}명 참여
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
          label="새로고침"
          accessibilityLabel="랭킹 새로고침"
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
