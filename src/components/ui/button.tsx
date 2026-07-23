import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  leftIcon?: IconName;
  style?: ViewStyle;
};

/** Primary app button (pill). Replaces the per-screen inline pull/submit/save buttons. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  leftIcon,
  style,
}: ButtonProps) {
  const t = useTokens();
  const Typography = useTypography();
  const bg = variant === 'secondary' ? t.surface : variant === 'danger' ? t.danger : t.primary;
  const fg = variant === 'secondary' ? t.text : t.onPrimary;

  return (
    <ScalePressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.btn,
        { backgroundColor: disabled ? t.textDisabled : bg },
        variant === 'secondary' && { borderWidth: 1, borderColor: t.border },
        style,
      ]}>
      <View style={styles.content}>
        {leftIcon ? <Icon name={leftIcon} size={18} color={fg} /> : null}
        <Text style={[Typography.label, { color: fg }]}>{label}</Text>
      </View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
