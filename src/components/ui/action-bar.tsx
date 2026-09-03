import { type ReactNode, useContext } from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { actionBarBottomOffset } from '@/components/ui/action-bar-geometry';
import { Spacing } from '@/constants/theme';
import { useLiquidGlass } from '@/hooks/use-liquid-glass';
import { useTokens } from '@/hooks/use-tokens';

export type ActionBarProps = {
  children: ReactNode;
  /** 폴백(불투명 바) 모드의 바 스타일 — 화면이 쓰던 footer 스타일을 그대로 넘긴다. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * 화면 하단 액션 바 (#1069) — 저장·적용하기 같은 단일 버튼 한 줄.
 *
 * - **리퀴드 글래스**: 바 자체는 없고 버튼만 콘텐츠 위에 떠 있다(absolute, 바텀바
 *   알약과 같은 바닥 여백). 밑을 지나는 스크롤 콘텐츠는 `useActionBarInset()`만큼
 *   하단 패딩. 버튼 면은 호출 쪽이 `GlassSurface tintColor`로 그린다.
 * - **불투명 바**: 종전 그대로 flex 형제(`style`로 넘긴 footer 스타일 + 상단 보더).
 */
export function ActionBar({ children, style, testID }: ActionBarProps) {
  const t = useTokens();
  const glass = useLiquidGlass();
  const insets = useContext(SafeAreaInsetsContext);
  if (glass) {
    return (
      <View
        testID={testID}
        pointerEvents="box-none"
        style={[styles.float, { bottom: actionBarBottomOffset(insets?.bottom ?? 0) }]}>
        {children}
      </View>
    );
  }
  return (
    <View testID={testID} style={[style, { borderTopColor: t.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  float: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    zIndex: 20,
  },
});
