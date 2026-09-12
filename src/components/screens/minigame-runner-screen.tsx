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
  readyTitle?: string;
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
  instructions = '화면을 탭해 장애물을 뛰어넘어요.\n오래 달릴수록 점수가 올라가요.',
  readyTitle = '고양이와 함께 폴짝!',
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
      <Text style={[Typography.body, { color: t.textMuted }]}>{instructions}</Text>
      {practice ? (
        <Text accessibilityRole="alert" style={[Typography.label, { color: t.primaryText }]}>
          연습 모드 · 랭킹에 기록되지 않아요
        </Text>
      ) : null}
      {game ?? (
        <GlassSurface
          interactive={false}
          glassEffectStyle="clear"
          fallbackColor={t.surface}
          style={styles.welcome}>
          <CharacterAvatar characterId="cat" pose={characterPose} size={Spacing.six * 2} />
          <Text style={[Typography.h3, { color: t.text }]}>{readyTitle}</Text>
        </GlassSurface>
      )}
      {pending ? (
        <ActivityIndicator
          color={t.primaryText}
          accessibilityLabel={finished ? '기록 저장 중' : '게임 준비 중'}
        />
      ) : null}
      {startError ? (
        <RetryState
          message="랭킹 게임을 준비하지 못했어요"
          detail={
            submitError
              ? '이전 게임 기록은 다시 저장할 수 있어요.'
              : '연결 상태 또는 게임 버전을 확인해주세요. 연습은 기록 없이 즐길 수 있어요.'
          }
          onRetry={submitError && !pending ? onRetrySubmit : undefined}
          retryLabel="기록 저장 다시 시도"
        />
      ) : null}
      {submitError && !startError ? (
        <RetryState
          message="기록을 저장하지 못했어요"
          detail="아직 랭킹에 반영됐는지 확인할 수 없어요. 같은 기록으로 다시 저장할 수 있어요."
          onRetry={pending ? undefined : onRetrySubmit}
          retryLabel="기록 저장 다시 시도"
        />
      ) : null}
      {result ? (
        <GlassSurface
          interactive={false}
          glassEffectStyle="clear"
          fallbackColor={t.surface}
          style={styles.result}>
          <Text style={[Typography.h3, { color: t.primaryText }]}>
            {result.personalBest ? '나의 최고 기록을 넘었어요!' : '기록을 저장했어요'}
          </Text>
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
              label={
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
            label={
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
          label="전체 유저 랭킹 보기"
          onPress={onLeaderboard}
          variant="secondary"
          disabled={pending}
        />
      ) : null}
      {game && !finished ? (
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          진행 중에 나가면 이번 게임은 끝나고 기록되지 않아요.
        </Text>
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
