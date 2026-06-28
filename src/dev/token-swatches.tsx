import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

/** Dev-only preview: renders the active brand tokens as labelled swatches. */
export function TokenSwatches() {
  const tokens = useTokens();

  return (
    <View style={styles.grid}>
      {Object.entries(tokens).map(([name, value]) => (
        <View key={name} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: value }]} />
          <ThemedText type="small">{name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {value}
          </ThemedText>
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
