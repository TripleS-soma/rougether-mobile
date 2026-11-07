import { type ReactNode, useContext, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { PagerGestureContext } from '@/components/ui/pager-scroll-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { hapticSelection } from '@/utils/haptics';
import { pressedStyle } from '@/components/ui/press-feedback';

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
/**
 * 열린 삭제 버튼은 한 번에 하나, 다른 동작을 하면 닫힌다 (#1676).
 *
 * 예전엔 밀어서 연 삭제 버튼이 삭제를 누르거나 되밀기 전까지 그대로 남았다 — 다른 곳을 눌러도,
 * 스크롤해도, 다른 행을 밀어도. 지금은 열린 행 하나를 모듈 전역에 기억하고, 앱 루트의
 * `onTouchStart`(앱 셸)가 **어떤 터치든** 들어오면 닫는다. 터치 이벤트는 자식에서 루트로
 * 올라오므로, 삭제 버튼의 터치는 버튼이 먼저 표시해 두고 루트가 그 한 번은 건너뛴다.
 * 시트·셸이 서로 다른 트리라 컨텍스트 대신 모듈 전역이다(BottomSheet 직렬화와 같은 이유).
 */
let openRow: SwipeableMethods | null = null;
let touchOnDeleteAction = false;

/**
 * '누르기 시작'에 거는 이벤트 이름 — 네이티브는 터치, 웹은 포인터(마우스 클릭엔 touchstart가 없다).
 * 둘 다 걸면 한 번의 누름에 두 번 불려, 삭제 버튼 표시를 첫 번째가 써 버리고 두 번째가 행을 닫는다.
 */
export const PRESS_START_EVENT = Platform.OS === 'web' ? 'onPointerDown' : 'onTouchStart';

/** 앱 루트의 누르기 시작 — 삭제 버튼을 누른 게 아니면 열린 행을 닫는다. */
export function closeOpenSwipeRow() {
  if (touchOnDeleteAction) {
    touchOnDeleteAction = false;
    return;
  }
  if (!openRow) return;
  const row = openRow;
  openRow = null;
  row.close();
}

/** 테스트 전용 — 스위트 간 누수 방지. */
export function __resetOpenSwipeRow() {
  openRow = null;
  touchOnDeleteAction = false;
}

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
  const tr = useT();
  const Typography = useTypography();
  const pager = useContext(PagerGestureContext);
  const swipeRef = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      enabled={!!onDelete}
      overshootRight={false}
      // 삭제 버튼 쪽으로 열리기로 정해지는 순간 한 번 (2026-11-04) — 손끝에 "걸렸다"를 알린다.
      // 다른 행이 열려 있으면 닫고 이 행을 기억한다 (#1676).
      onSwipeableWillOpen={
        onDelete
          ? () => {
              hapticSelection();
              const self = swipeRef.current;
              if (openRow && openRow !== self) openRow.close();
              openRow = self;
            }
          : undefined
      }
      onSwipeableClose={() => {
        if (openRow === swipeRef.current) openRow = null;
      }}
      blocksExternalGesture={pager}
      renderRightActions={
        onDelete
          ? () => (
              <Pressable
                // 이 터치는 루트가 '다른 동작'으로 보고 닫지 않게 먼저 표시한다 (#1676).
                {...{
                  [PRESS_START_EVENT]: () => {
                    touchOnDeleteAction = true;
                  },
                }}
                onPress={() => {
                  if (openRow === swipeRef.current) openRow = null;
                  swipeRef.current?.close();
                  onDelete();
                }}
                accessibilityRole="button"
                accessibilityLabel={tr('routineTodo.swipeDelete.a11y', { label })}
                style={({ pressed }) => [
                  styles.deleteAction,
                  { backgroundColor: t.danger },
                  pressed && pressedStyle('dim', t),
                ]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>
                  {tr('routineTodo.swipeDelete.label')}
                </Text>
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
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
