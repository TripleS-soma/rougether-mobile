import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { MinigameResult } from '@/api/minigames';
import { CharacterAvatar } from '@/components/room/character-avatar';
import { MinigameLayout } from '@/components/screens/minigame-layout';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { RetryState } from '@/components/ui/retry-state';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type MinigameRunnerScreenProps = {
  gameName?: string;
  instructions?: string;
  characterPose?: number;
  game?: ReactNode;
  practice?: boolean;
  finished?: boolean;
  pending?: boolean;
  startError?: boolean;
  submitError?: boolean;
  result?: MinigameResult | null;
  onStart?: () => void;
  onPractice?: () => void;
  onRetrySubmit?: () => void;
  onLeaderboard?: () => void;
  onBack?: () => void;
};

export function MinigameRunnerScreen({
  gameName,
  instructions,
  characterPose = 1,
  game,
  practice,
  finished,
  pending,
  startError,
  submitError,
  result,
  onStart,
  onPractice,
  onRetrySubmit,
  onLeaderboard,
  onBack,
}: MinigameRunnerScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const name = gameName ?? tr('roomShop.minigame.runner.name');
  const hint = instructions ?? tr('roomShop.minigame.runner.instructions');
  return (
    <MinigameLayout title={name} onBack={onBack}>
      {practice ? (
        <Text accessibilityRole="alert" style={[Typography.label, { color: t.primaryText }]}>
          {tr('roomShop.minigame.practiceSection')}
        </Text>
      ) : null}
      {!result &&
        (game ?? (
          <GlassSurface
            interactive={false}
            glassEffectStyle="clear"
            fallbackColor={t.surface}
            style={styles.welcome}>
            <CharacterAvatar characterId="cat" pose={characterPose} size={Spacing.six * 2} />
            <Text style={[Typography.body, { color: t.textMuted }]}>{hint}</Text>
          </GlassSurface>
        ))}
      {pending ? (
        <ActivityIndicator
          color={t.primaryText}
          accessibilityLabel={tr(
            finished ? 'roomShop.minigame.play.savingA11y' : 'roomShop.minigame.play.preparingA11y',
          )}
        />
      ) : null}
      {startError ? (
        <RetryState
          message={tr('roomShop.minigame.play.startError')}
          detail={submitError ? tr('roomShop.minigame.play.pendingSubmit') : undefined}
          onRetry={submitError && !pending ? onRetrySubmit : undefined}
          retryLabel={tr('roomShop.minigame.play.retrySave')}
        />
      ) : null}
      {submitError && !startError ? (
        <RetryState
          message={tr('roomShop.minigame.play.submitError')}
          onRetry={pending ? undefined : onRetrySubmit}
          retryLabel={tr('roomShop.minigame.play.retrySave')}
        />
      ) : null}
      {result ? (
        <GlassSurface
          interactive={false}
          glassEffectStyle="clear"
          fallbackColor={t.surface}
          style={styles.result}>
          {result.personalBest ? (
            <Text style={[Typography.label, { color: t.primaryText }]}>
              {tr('roomShop.minigame.play.personalBest')}
            </Text>
          ) : null}
          <Text style={[Typography.h2, { color: t.text }]}>
            {tr('roomShop.minigame.play.score', { score: result.score.toLocaleString() })}
          </Text>
          <Text style={[Typography.body, { color: t.textMuted }]}>
            {tr('roomShop.minigame.play.summary', {
              best: result.bestScore.toLocaleString(),
              rank: result.rank,
            })}
          </Text>
        </GlassSurface>
      ) : null}
      {!game || finished ? (
        <View style={styles.actions}>
          {onStart ? (
            <Button
              glass
              label={tr(game ? 'roomShop.minigame.play.retry' : 'roomShop.minigame.start')}
              accessibilityLabel={tr(
                submitError
                  ? 'roomShop.minigame.play.retryAfterErrorA11y'
                  : game
                    ? 'roomShop.minigame.play.retryRankedA11y'
                    : 'roomShop.minigame.play.rankedA11y',
              )}
              onPress={onStart}
              disabled={pending}
            />
          ) : null}
          <Button
            glass
            label={tr(
              practice && game
                ? 'roomShop.minigame.play.practiceAgain'
                : 'roomShop.minigame.practice',
            )}
            accessibilityLabel={tr(
              submitError
                ? 'roomShop.minigame.play.practiceAfterErrorA11y'
                : practice && game
                  ? 'roomShop.minigame.play.practiceAgainA11y'
                  : 'roomShop.minigame.play.practiceA11y',
            )}
            onPress={onPractice}
            disabled={pending}
            variant="secondary"
          />
        </View>
      ) : null}
      {(!game || finished) && onLeaderboard ? (
        <Button
          glass
          label={tr('roomShop.minigame.ranking')}
          accessibilityLabel={tr('roomShop.minigame.play.leaderboardA11y')}
          onPress={onLeaderboard}
          variant="secondary"
          disabled={pending}
        />
      ) : null}
    </MinigameLayout>
  );
}

const styles = StyleSheet.create({
  welcome: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.xl,
  },
  result: { padding: Spacing.four, gap: Spacing.two, borderRadius: Radius.xl },
  actions: { gap: Spacing.two },
});
