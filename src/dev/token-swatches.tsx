import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/** Dev-only preview: renders the active brand tokens as labelled swatches. */
export function TokenSwatches() {
  const tokens = useTokens();
  const theme = useTheme();
  const Typography = useTypography();

  return (
    <View style={styles.grid}>
      {Object.entries(tokens).map(([name, value]) => (
        <View key={name} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: value }]} />
          <Text style={[Typography.supporting, { color: theme.text }]}>{name}</Text>
          <Text style={[Typography.supporting, { color: theme.textSecondary }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  item: {
    width: 96,
    gap: Spacing.half,
  },
  swatch: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  },
});
