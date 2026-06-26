import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SampleButtonProps = {
  label: string;
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
  disabled?: boolean;
};

/**
 * Reference component for the harness. Pure React Native (no native modules),
 * theme-aware, and easy to test — copy this shape when porting screens from the
 * prototype, and register new components in `src/dev/registry.tsx`.
 */
export function SampleButton({ label, variant = 'primary', onPress, disabled }: SampleButtonProps) {
  const theme = useTheme();
  const backgroundColor =
    variant === 'primary' ? theme.backgroundSelected : theme.backgroundElement;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="smallBold" themeColor={variant === 'primary' ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
