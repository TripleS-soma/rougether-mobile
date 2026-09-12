import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type ButtonProps = {
  label: string;
  accessibilityLabel?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  leftIcon?: IconName;
  style?: ViewStyle;
  glass?: boolean;
};

/** Primary app button (pill). Replaces the per-screen inline pull/submit/save buttons. */
export function Button({
  label,
  accessibilityLabel = label,
  onPress,
  variant = 'primary',
  disabled,
  leftIcon,
  style,
  glass = false,
}: ButtonProps) {
  const t = useTokens();
  const Typography = useTypography();
  const bg = variant === 'secondary' ? t.surface : variant === 'danger' ? t.danger : t.primary;
  const fg = glass
    ? disabled
      ? t.textDisabled
      : variant === 'primary'
        ? t.primaryText
        : variant === 'danger'
          ? t.danger
          : t.text
    : variant === 'secondary'
      ? t.text
      : t.onPrimary;
  const content = (
    <View style={styles.content}>
      {leftIcon ? <Icon name={leftIcon} size={18} color={fg} /> : null}
      <Text style={[Typography.label, { color: fg }]}>{label}</Text>
    </View>
  );

  return (
    <ScalePressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        glass
          ? styles.glassHost
          : [
              styles.btn,
              { backgroundColor: disabled ? t.textDisabled : bg },
              variant === 'secondary' && { borderWidth: 1, borderColor: t.border },
            ],
        style,
      ]}>
      {glass ? (
        <GlassSurface
          fallbackColor={t.surface}
          interactive={!disabled}
          style={[styles.btn, styles.glassFace]}>
          {content}
        </GlassSurface>
      ) : (
        content
      )}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  glassHost: { borderRadius: Radius.pill },
  glassFace: { width: '100%', minHeight: Spacing.five + Spacing.three, justifyContent: 'center' },
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
