import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { galleryEntries } from '@/dev/registry';

/**
 * Component gallery — the visual half of the dev/test harness. Lists every
 * entry from `src/dev/registry.tsx` so components can be previewed in isolation.
 */
export default function DevGalleryScreen() {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Component gallery</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {galleryEntries.length} entries · edit src/dev/registry.tsx to add more
            </ThemedText>
          </View>

          {galleryEntries.map((entry) => (
            <View key={entry.name} style={styles.entry}>
              <ThemedText type="smallBold">{entry.name}</ThemedText>
              {entry.description ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {entry.description}
                </ThemedText>
              ) : null}
              <ThemedView type="backgroundElement" style={styles.preview}>
                {entry.render()}
              </ThemedView>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
