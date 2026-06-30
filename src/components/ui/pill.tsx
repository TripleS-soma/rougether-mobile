import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type PillProps = {
  label: string;
  icon?: IconName;
  /** Background; defaults to the muted surface token. */
  background?: string;
  color?: string;
  style?: ViewStyle;
};

/** Small rounded label chip (e.g. leaf balance, level). */
export function Pill({ label, icon, background, color, style }: PillProps) {
  const t = useTokens();
  return (
    <View style={[styles.pill, { backgroundColor: background ?? t.surfaceMuted }, style]}>
      {icon ? <Icon name={icon} size={14} color={color ?? t.text} /> : null}
      <Text style={[Typography.label, { color: color ?? t.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
});
