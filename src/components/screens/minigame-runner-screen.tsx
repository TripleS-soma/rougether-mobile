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
  gameName = '루틴 러너',
  instructions = '탭해서 점프',
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
  return (
    <MinigameLayout title={gameName} onBack={onBack}>
      {practice ? (
        <Text accessibilityRole="alert" style={[Typography.label, { color: t.primaryText }]}>
          연습 · 기록 안 함
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
            <Text style={[Typography.body, { color: t.textMuted }]}>{instructions}</Text>
          </GlassSurface>
        ))}
      {pending ? (
        <ActivityIndicator
          color={t.primaryText}
          accessibilityLabel={finished ? '기록 저장 중' : '게임 준비 중'}
        />
      ) : null}
      {startError ? (
        <RetryState
          message="게임을 시작하지 못했어요"
          detail={submitError ? '이전 기록 저장 대기 중' : undefined}
          onRetry={submitError && !pending ? onRetrySubmit : undefined}
          retryLabel="다시 저장"
        />
      ) : null}
      {submitError && !startError ? (
        <RetryState
          message="기록을 저장하지 못했어요"
          onRetry={pending ? undefined : onRetrySubmit}
          retryLabel="다시 저장"
        />
      ) : null}
      {result ? (
        <GlassSurface
          interactive={false}
          glassEffectStyle="clear"
          fallbackColor={t.surface}
          style={styles.result}>
          {result.personalBest ? (
            <Text style={[Typography.label, { color: t.primaryText }]}>최고 기록</Text>
          ) : null}
          <Text style={[Typography.h2, { color: t.text }]}>{result.score.toLocaleString()}점</Text>
          <Text style={[Typography.body, { color: t.textMuted }]}>
            최고 {result.bestScore.toLocaleString()}점 · 전체 {result.rank}위
          </Text>
        </GlassSurface>
      ) : null}
      {!game || finished ? (
        <View style={styles.actions}>
          {onStart ? (
            <Button
              glass
              label={game ? '다시 하기' : '시작'}
              accessibilityLabel={
                submitError
                  ? '저장 재시도를 그만하고 새 도전'
                  : game
                    ? '다시 랭킹 도전'
                    : '랭킹 도전'
              }
              onPress={onStart}
              disabled={pending}
            />
          ) : null}
          <Button
            glass
            label={practice && game ? '다시 연습' : '연습'}
            accessibilityLabel={
              submitError
                ? '저장 재시도를 그만하고 연습'
                : practice && game
                  ? '다시 연습하기'
                  : '연습하기 · 랭킹 미기록'
            }
            onPress={onPractice}
            disabled={pending}
            variant="secondary"
          />
        </View>
      ) : null}
      {(!game || finished) && onLeaderboard ? (
        <Button
          glass
          label="랭킹"
          accessibilityLabel="전체 유저 랭킹 보기"
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
