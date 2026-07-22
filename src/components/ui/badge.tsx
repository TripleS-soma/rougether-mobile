import { StyleSheet, Text } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens } from '@/hooks/use-tokens';

export type BadgeProps = {
  label: string;
  /** Pill background; defaults to the brand primary. */
  background?: string;
  color?: string;
};

/** Tiny label pill (e.g. rarity, MY, 투두). */
export function Badge({ label, background, color }: BadgeProps) {
  const t = useTokens();
  const emph = useFontEmphasis();
  return (
    <Text
      style={[
        styles.badge,
        emph('bold'),
        { backgroundColor: background ?? t.primary, color: color ?? t.onPrimary },
      ]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 10,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
});
