import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type ScreenHeaderProps = {
  title: string;
  /** When provided, shows a back button on the left. */
  onBack?: () => void;
  backLabel?: string;
  /** Optional content pinned to the right (e.g. an action button or pill). */
  right?: ReactNode;
};

/** Standard screen header: optional back button + title + optional right slot. */
export function ScreenHeader({ title, onBack, backLabel = '뒤로 가기', right }: ScreenHeaderProps) {
  const t = useTokens();
  return (
    <View style={[styles.header, { backgroundColor: t.surface }]}>
      <View style={styles.left}>
        {onBack ? <IconButton name="back" accessibilityLabel={backLabel} onPress={onBack} /> : null}
        <Text style={[Typography.h2, { color: t.text }]}>{title}</Text>
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
});
