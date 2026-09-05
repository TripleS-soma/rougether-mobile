import { type ReactNode, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { actionBarBottomOffset } from '@/components/ui/action-bar-geometry';
import { Spacing } from '@/constants/theme';

export type ActionBarProps = {
  children: ReactNode;
  testID?: string;
};

/**
 * 화면 하단 액션 바 (#1069 → #1074에서 전 플랫폼 공통) — 저장·적용하기 같은 단일
 * 버튼 한 줄. 바 자체는 없고 버튼만 콘텐츠 위에 떠 있다(absolute, 바텀바 알약과
 * 같은 바닥 여백 — 시스템 내비게이션 바 인셋 포함). 밑을 지나는 스크롤 콘텐츠는
 * `useActionBarInset()`만큼 하단 패딩. 버튼 면은 호출 쪽이 `GlassSurface`로 그린다
 * (강조는 `tintColor`).
 */
export function ActionBar({ children, testID }: ActionBarProps) {
  const insets = useContext(SafeAreaInsetsContext);
  return (
    <View
      testID={testID}
      pointerEvents="box-none"
      style={[styles.float, { bottom: actionBarBottomOffset(insets?.bottom ?? 0) }]}>
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
