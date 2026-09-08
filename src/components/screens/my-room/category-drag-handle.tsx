import { memo, type ReactNode, useMemo } from 'react';
import { type Animated, type StyleProp, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useLatestRef } from '@/hooks/use-stable-value';

/**
 * 카테고리 헤더 드래그를 여는 꾹 누름 (2026-09-08). 행(220ms)보다 길고 집 순서
 * (350ms)보다 짧다 — 헤더 탭에는 수정 시트·＋ 같은 진짜 동작이 있어 행보다 여유를
 * 두되, 스크롤 중 스치는 손가락에 잡히지 않을 만큼만.
 */
const CATEGORY_DRAG_LONG_PRESS_MS = 300;

export type CategoryDragHandleProps = {
  /** 카테고리 id — 부모의 디스패치 키. 미분류(pseudo)는 ''. */
  categoryId: string;
  /** 롱프레스 드래그 대상인가 (실제 카테고리 + 행 드래그 중이 아닐 때). */
  draggable: boolean;
  /** 들린 그룹이 손가락을 따라가는 오프셋 — 부모 소유(그룹 컨테이너에 적용). */
  dragTY: Animated.Value;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;

  // --- 참조 고정 계약 (#769와 동일). 부모가 useStableCallback으로 준다. ---
  onDragStart: (categoryId: string) => void;
  onDragUpdate: (categoryId: string, translationY: number) => void;
  onDragEnd: (categoryId: string) => void;
  onDragFinalize: (categoryId: string) => void;
};

/**
 * 카테고리 그룹 헤더의 롱프레스 팬 (2026-09-08). 행(RoutineRow)과 같은 규칙 —
 * 제스처는 `draggable`이 바뀔 때만 다시 만들고 최신 핸들러는 ref로 읽으며, 켜고
 * 끄기는 `.enabled()`로만 다뤄 트리 모양을 고정한다(#1207의 뷰 재활용 함정). 들어
 * 올리는 건 헤더가 아니라 **그룹 전체**라 translateY는 부모의 그룹 컨테이너가
 * 받고, 여기서는 값만 갱신한다.
 */
function CategoryDragHandleBase({
  categoryId,
  draggable,
  dragTY,
  style,
  children,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onDragFinalize,
}: CategoryDragHandleProps) {
  const handlers = useLatestRef({ onDragStart, onDragUpdate, onDragEnd, onDragFinalize });
  const idRef = useLatestRef(categoryId);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .withTestId(`category-drag-${categoryId || 'uncat'}`)
        .enabled(draggable)
        .activateAfterLongPress(CATEGORY_DRAG_LONG_PRESS_MS)
        // runOnJS: 부모의 레이아웃 맵·Animated.Value를 그대로 쓴다 (행과 동일).
        .runOnJS(true)
        .onStart(() => handlers.current.onDragStart(idRef.current))
        .onUpdate((e) => {
          dragTY.setValue(e.translationY);
          handlers.current.onDragUpdate(idRef.current, e.translationY);
        })
        .onEnd(() => handlers.current.onDragEnd(idRef.current))
        .onFinalize(() => handlers.current.onDragFinalize(idRef.current)),
    [categoryId, draggable, dragTY, handlers, idRef],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={style}>{children}</View>
    </GestureDetector>
  );
}

export const CategoryDragHandle = memo(CategoryDragHandleBase);
