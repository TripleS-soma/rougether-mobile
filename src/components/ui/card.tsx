import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Elevated surface container with standard padding/radius. */
export function Card({ children, style }: CardProps) {
  const t = useTokens();
  return <View style={[styles.card, { backgroundColor: t.surface }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
