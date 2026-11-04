import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MinigameResult } from '@/api/minigames';
import { CharacterAvatar } from '@/components/room/character-avatar';
import { MinigameLayout } from '@/components/screens/minigame-layout';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon, type IconName } from '@/components/ui/icon';
import { pressedStyle } from '@/components/ui/press-feedback';
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
  /**
   * 새 최고 기록 자랑 제안 (2026-10-14) — 결과 아래 "새 기록이에요! 피드에 기록을 자랑할까요?"
   * [자랑하기] / [괜찮아요]. 조건(랭킹전·최고 기록·10판 이상·피드 켜짐)과 판당 1회는 셸이 판정해
   * true를 넘긴다.
   */
  sharePrompt?: boolean;
  onShareRecord?: () => void;
  onDismissShare?: () => void;
  onBack?: () => void;
  /** 규칙 카드 세 줄 — 조작·점수·끝나는 때. */
  rules?: string[];
  /** 규칙 카드를 시작 전 자리에 띄울지 — 게임별 첫 진입이나 ? 다시 보기. */
  showRules?: boolean;
  onDismissRules?: () => void;
  /** 제목줄 ? — 규칙 카드 다시 보기. 게임 중엔 숨긴다. */
  onOpenRules?: () => void;
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
  sharePrompt = false,
  onShareRecord,
  onDismissShare,
  onBack,
  rules,
  showRules = false,
  onDismissRules,
  onOpenRules,
}: MinigameRunnerScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const name = gameName ?? tr('roomShop.minigame.runner.name');
  const hint = instructions ?? tr('roomShop.minigame.runner.instructions');
  return (
    <MinigameLayout
      title={name}
      onBack={onBack}
      right={
        // 결과 화면엔 카드 자리가 없다 — 눌러도 반응 없다가 다시 시작할 때 튀어나왔다.
        onOpenRules && !game && !result ? (
          <Pressable
            onPress={onOpenRules}
            accessibilityRole="button"
            accessibilityLabel={tr('roomShop.minigame.rulesA11y')}
            hitSlop={8}
            style={({ pressed }) => pressed && pressedStyle('dim', t)}>
            <Icon name="help" size={20} color={t.textMuted} />
          </Pressable>
        ) : undefined
      }>
      {practice ? (
        <Text accessibilityRole="alert" style={[Typography.label, { color: t.primaryText }]}>
          {tr('roomShop.minigame.practiceSection')}
        </Text>
      ) : null}
      {!result &&
        (game ??
          (showRules && rules ? (
            <GlassSurface
              interactive={false}
              glassEffectStyle="clear"
              fallbackColor={t.surface}
              style={styles.rules}>
              <Text style={[Typography.h3, { color: t.text }]}>
                {tr('roomShop.minigame.rulesTitle')}
              </Text>
              {rules.map((line, i) => (
                <View key={RULE_ICONS[i] ?? i} style={styles.ruleRow}>
                  <Icon name={RULE_ICONS[i] ?? 'star'} size={20} color={t.primary} />
                  <Text style={[Typography.body, styles.flex, { color: t.text }]}>{line}</Text>
                </View>
              ))}
              <Button label={tr('roomShop.minigame.rulesOk')} onPress={onDismissRules} />
            </GlassSurface>
          ) : (
            <GlassSurface
              interactive={false}
              glassEffectStyle="clear"
              fallbackColor={t.surface}
              style={styles.welcome}>
              <CharacterAvatar characterId="cat" pose={characterPose} size={Spacing.six * 2} />
              <Text style={[Typography.body, { color: t.textMuted }]}>{hint}</Text>
            </GlassSurface>
          )))}
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
      {result && sharePrompt ? (
        <GlassSurface
          interactive={false}
          glassEffectStyle="clear"
          fallbackColor={t.primarySoft}
          style={styles.share}
          testID="minigame-share-prompt">
          <Text accessibilityRole="header" style={[Typography.label, { color: t.text }]}>
            {tr('roomShop.minigame.play.shareTitle')}
          </Text>
          <View style={styles.shareActions}>
            <Button
              label={tr('roomShop.minigame.play.shareDismiss')}
              onPress={onDismissShare}
              variant="secondary"
              style={styles.shareButton}
            />
            <Button
              label={tr('roomShop.minigame.play.shareAccept')}
              accessibilityLabel={tr('roomShop.minigame.play.shareAcceptA11y')}
              onPress={onShareRecord}
              leftIcon="sparkles"
              style={styles.shareButton}
            />
          </View>
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

/** 규칙 줄 앞 표식 — 조작·점수·끝나는 때 (#1613). */
const RULE_ICONS: readonly IconName[] = ['tap', 'star', 'finish'];

const styles = StyleSheet.create({
  welcome: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
  },
  rules: { padding: Spacing.four, gap: Spacing.three, borderRadius: Radius.xl },
  ruleRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  flex: { flex: 1 },
  result: { padding: Spacing.four, gap: Spacing.two, borderRadius: Radius.xl },
  actions: { gap: Spacing.two },
  share: { padding: Spacing.three, gap: Spacing.three, borderRadius: Radius.xl },
  shareActions: { flexDirection: 'row', gap: Spacing.two },
  shareButton: { flex: 1, paddingHorizontal: Spacing.two },
});
