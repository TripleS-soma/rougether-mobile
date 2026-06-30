import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { useTokens } from '@/hooks/use-tokens';

export type IconButtonVariant = 'muted' | 'primary' | 'ghost';

export type IconButtonProps = {
  name: IconName;
  onPress?: () => void;
  /** Required for accessibility — describes the action (e.g. "뒤로 가기"). */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: number;
  disabled?: boolean;
  style?: ViewStyle;
};

/** Circular icon button used in headers / action bars. */
export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  variant = 'muted',
  size = 40,
  disabled,
  style,
}: IconButtonProps) {
  const t = useTokens();
  const bg =
    variant === 'primary' ? t.primary : variant === 'ghost' ? 'transparent' : t.surfaceMuted;
  const iconColor = variant === 'primary' ? t.onPrimary : t.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.btn,
        { backgroundColor: bg, width: size, height: size, borderRadius: size / 2 },
        disabled && styles.disabled,
        style,
      ]}>
      <Icon
        name={name}
        size={Math.round(size * 0.5)}
        color={disabled ? t.textDisabled : iconColor}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});
