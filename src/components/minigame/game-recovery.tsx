import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import type { GameError } from '@/components/minigame/use-game-recovery';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export function GameRecovery({ error, onRetry }: { error: GameError; onRetry: () => void }) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.content}>
      <Text accessibilityRole="alert" style={[Typography.body, styles.message, { color: t.text }]}>
        {error === 'finish' ? '게임 기록을 확인하지 못했어요.' : '게임을 불러오지 못했어요.'}
      </Text>
      <Button label="다시 시작" glass onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  message: { textAlign: 'center' },
});
