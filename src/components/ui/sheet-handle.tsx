import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

/**
 * 바텀시트 상단의 드래그 그래버 (#1015) — 40×4 pill. 세 시트(gacha·
 * date-edit·routine-menu)에 글자 하나까지 같게 복제돼 있던 것을 모았다.
 * 장식 요소라 접근성 트리에는 올리지 않는다.
 */
export function SheetHandle() {
  const t = useTokens();
  return (
    <View
      testID="sheet-handle"
      importantForAccessibility="no"
      style={[styles.handle, { backgroundColor: t.border }]}
    />
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.one,
  },
});
