import { type ReactNode, useContext, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { PagerGestureContext } from '@/components/ui/pager-scroll-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 루틴/할일 행 스와이프 삭제 (#566) — 왼쪽으로 밀면 빨간 '삭제' 액션이
 * 드러나고, **액션을 탭해야** 삭제 콜백이 나간다(파괴적 액션이라 풀스와이프
 * 즉시 삭제는 하지 않는다 — reveal + 탭 2단계).
 *
 * 삭제가 배선되지 않은 행(달력 탭 서버 기반 항목 등)도 **같은 Swipeable 트리**로
 * 그린다 (#1207) — 팬만 `enabled={false}`, 오른쪽 액션 없음. 예전엔 children을
 * 그대로 돌려줘 행 트리 모양이 둘이었고, 삭제 가능 여부가 바뀔 때마다 행이
 * 재마운트돼 iOS/Fabric 뷰 재활용과 RNGH reactTag가 어긋나는 원인 하나였다.
 *
 * 탭 페이저와의 관계: 가로 행 스와이프는 페이저(iOS는 24px에서 수동 활성)와 같은
 * 축을 두고 겨룬다. 페이저가 **이 팬의 실패를 기다리게**(`blocksExternalGesture`)
 * 해서, 행 팬이 10px에서 먼저 잡히면 페이저는 무산되고, 세로 스크롤은 페이저가
 * 스스로 실패하니 그대로 통한다. 스크롤처럼 `requireExternalGestureToFail`을 쓰면
 * 반대로 행 팬이 페이저 실패를 기다려 가로 스와이프가 영영 안 잡힌다. 페이저
 * 컨텍스트가 없으면(단독 화면·Android) 관계 없이 그대로 동작한다.
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
  const pager = useContext(PagerGestureContext);
  const swipeRef = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      enabled={!!onDelete}
      overshootRight={false}
      blocksExternalGesture={pager}
      renderRightActions={
        onDelete
          ? () => (
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
            )
          : undefined
      }>
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
