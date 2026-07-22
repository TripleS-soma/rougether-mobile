import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography as StaticTypography, type TypeRole } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const ROLES = Object.keys(StaticTypography) as TypeRole[];

/** Dev-only preview: renders every type-scale role at its size/weight. */
export function TypeScalePreview() {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.list}>
      {ROLES.map((role) => (
        <View key={role} style={styles.row}>
          <Text style={[styles.tag, { color: t.textMuted }]}>{role}</Text>
          <Text style={[Typography[role], { color: t.text }]}>천 리 길도 한 걸음</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
    alignSelf: 'stretch',
  },
  row: {
    gap: Spacing.half,
  },
  tag: {
    fontSize: 11,
  },
});
