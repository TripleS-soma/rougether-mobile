import { type ReactNode, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 루틴/할일 행 스와이프 삭제 (#566) — 왼쪽으로 밀면 빨간 '삭제' 액션이
 * 드러나고, **액션을 탭해야** 삭제 콜백이 나간다(파괴적 액션이라 풀스와이프
 * 즉시 삭제는 하지 않는다 — reveal + 탭 2단계). 삭제가 배선되지 않은 행
 * (달력 탭 서버 기반 항목 등)은 스와이프 없이 그대로 렌더.
 */
export function SwipeDeleteRow({
  label,
  onDelete,
  children,
}: {
  label: string;
  onDelete?: () => void;
  children: ReactNode;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const swipeRef = useRef<SwipeableMethods>(null);
  if (!onDelete) return children;
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label} 스와이프 삭제`}
          style={[styles.deleteAction, { backgroundColor: t.danger }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>삭제</Text>
        </Pressable>
      )}>
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  // 스와이프 삭제 액션 (#566) — 행 오른쪽에 드러나는 빨간 버튼.
  deleteAction: {
    width: Spacing.six,
    marginLeft: Spacing.two,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
