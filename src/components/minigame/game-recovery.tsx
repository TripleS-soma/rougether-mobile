import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import type { GameError } from '@/components/minigame/use-game-recovery';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export function GameRecovery({ error, onRetry }: { error: GameError; onRetry: () => void }) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  return (
    <View style={styles.content}>
      <Text accessibilityRole="alert" style={[Typography.body, styles.message, { color: t.text }]}>
        {tr(
          error === 'finish'
            ? 'roomShop.minigame.recovery.finishError'
            : 'roomShop.minigame.recovery.loadError',
        )}
      </Text>
      <Button label={tr('roomShop.minigame.recovery.restart')} glass onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  message: { textAlign: 'center' },
});
