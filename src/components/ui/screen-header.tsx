import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { useHeaderInsetStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type ScreenHeaderProps = {
  title: string;
  /** When provided, shows a back button on the left. */
  onBack?: () => void;
  backLabel?: string;
  /** Optional content pinned to the right (e.g. an action button or pill). */
  right?: ReactNode;
};

/**
 * Standard screen header: optional back button + title + optional right slot.
 * 상태바 인셋을 헤더가 직접 갖는다 (#493) — surface 배경이 상태바 밑까지
 * 이어져 시스템 바 영역과 헤더가 한 색으로 읽힌다. 사용하는 화면의 루트는
 * `useScreenStyle([])`(top 패딩 없음)이어야 이중 패딩이 안 생긴다.
 */
export function ScreenHeader({ title, onBack, backLabel = '뒤로 가기', right }: ScreenHeaderProps) {
  const t = useTokens();
  const Typography = useTypography();
  const headerInset = useHeaderInsetStyle();
  return (
    <View
      testID="screen-header"
      style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
      <View style={styles.left}>
        {onBack ? <IconButton name="back" accessibilityLabel={backLabel} onPress={onBack} /> : null}
        <Text style={[Typography.h2, { color: t.text }]}>{title}</Text>
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
});
