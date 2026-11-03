import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';

export function MinigameLayout({
  title,
  onBack,
  right,
  children,
}: {
  title: string;
  onBack?: () => void;
  /** 제목줄 오른쪽 — 예: 게임 방법 ?. */
  right?: ReactNode;
  children: ReactNode;
}) {
  const column = useResponsiveColumn();
  const inset = useHeaderContentInset();
  const screenStyle = useScreenStyle(['bottom']);
  return (
    <View style={[styles.screen, screenStyle]}>
      <ScreenHeader title={title} onBack={onBack} right={right} />
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
