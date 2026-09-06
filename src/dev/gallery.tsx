import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { Spacing } from '@/constants/theme';
import { galleryEntries } from '@/dev/registry';
import { useTheme } from '@/hooks/use-theme';
import { useFontEmphasis, useTypography } from '@/hooks/use-tokens';

/**
 * Component gallery — the visual half of the dev/test harness. Lists every
 * entry from `src/dev/registry.tsx` so components can be previewed in isolation.
 * Lives under src/dev/ (not the route file) so the production bundle can drop
 * it together with the registry; the /dev route lazy-requires it behind __DEV__.
 */
export function DevGallery() {
  const { entry: rawEntry } = useLocalSearchParams<{ entry?: string | string[] }>();
  const entry = Array.isArray(rawEntry) ? rawEntry[0] : rawEntry;
  const entries = entry ? galleryEntries.filter((item) => item.name === entry) : galleryEntries;
  const theme = useTheme();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={[Typography.h2, { color: theme.text }]}>Component gallery</Text>
            <Text style={[Typography.supporting, { color: theme.textSecondary }]}>
              {entries.length} entries · edit src/dev/registry.tsx to add more
            </Text>
          </View>

          {entries.map((entry) => (
            <View key={entry.name} style={styles.entry}>
              <Text style={[Typography.supporting, emph('bold'), { color: theme.text }]}>
                {entry.name}
              </Text>
              {entry.description ? (
                <Text style={[Typography.supporting, { color: theme.textSecondary }]}>
                  {entry.description}
                </Text>
              ) : null}
              <View style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
                {entry.render()}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  entry: {
    gap: Spacing.two,
  },
  preview: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'flex-start',
  },
});
