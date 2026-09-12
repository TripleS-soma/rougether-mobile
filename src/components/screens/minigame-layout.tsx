import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';

export function MinigameLayout({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  const column = useResponsiveColumn();
  const inset = useHeaderContentInset();
  const screenStyle = useScreenStyle(['bottom']);
  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader title={title} onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.body, column, { paddingTop: inset }]}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.five },
});
