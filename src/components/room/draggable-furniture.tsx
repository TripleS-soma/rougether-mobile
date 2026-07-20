import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { FREE_ITEM_WIDTH } from '@/components/room/room';
import type { FurnitureItem, PlacedFurniture } from '@/resources/furniture';

/** 중심 좌표가 이 범위를 벗어나면 드래그아웃 = 빼기 (#327). */
export const DRAG_OUT_MARGIN = 0.08;

export type DraggableFurnitureProps = {
  item: FurnitureItem;
  placement: PlacedFurniture;
  /** 방 렌더 영역 크기(px) — 좌표 정규화의 기준. */
  roomSize: { w: number; h: number };
  /**
   * 드래그 종료 — 정규화 중심 좌표. 방 밖(DRAG_OUT_MARGIN 초과)이면 화면이
   * 빼기로 처리하고, 안이면 좌표를 커밋한다(z 최상위 승격 포함).
   */
  onDragEnd: (furnitureId: string, x: number, y: number) => void;
};

/**
 * 꾸미기 캔버스의 드래그 가능한 가구 (#327, RNGH + Reanimated). 위치는 UI
 * 스레드의 shared value로 움직이고, 놓는 순간에만 JS로 좌표를 커밋한다.
 */
export function DraggableFurniture({
  item,
  placement,
  roomSize,
  onDragEnd,
}: DraggableFurnitureProps) {
  const cx = useSharedValue(placement.x * roomSize.w);
  const cy = useSharedValue(placement.y * roomSize.h);
  const start = useSharedValue({ x: 0, y: 0 });
  const dragging = useSharedValue(false);

  // 부모 상태(좌표 커밋·재로드)와 방 크기 변화를 따라간다.
  useEffect(() => {
    cx.value = placement.x * roomSize.w;
    cy.value = placement.y * roomSize.h;
  }, [placement.x, placement.y, roomSize.w, roomSize.h, cx, cy]);

  // 주의: 드래그 중에는 React 상태를 건드리지 않는다 — 리렌더가 제스처를
  // 재생성해 활성 팬을 취소시킨다. z 승격은 드롭 커밋에서 처리.
  const pan = Gesture.Pan()
    .onStart(() => {
      dragging.value = true;
      start.value = { x: cx.value, y: cy.value };
    })
    .onUpdate((e) => {
      cx.value = start.value.x + e.translationX;
      cy.value = start.value.y + e.translationY;
    })
    .onEnd(() => {
      dragging.value = false;
      runOnJS(onDragEnd)(placement.furnitureId, cx.value / roomSize.w, cy.value / roomSize.h);
    })
    .onFinalize(() => {
      dragging.value = false;
    });

  const itemW = roomSize.w * FREE_ITEM_WIDTH;
  const animStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: cx.value - itemW / 2,
    top: cy.value - itemW / 2,
    width: itemW,
    height: itemW,
    // 드는 동안 살짝 커지고 최상위로 — 잡았다는 피드백.
    transform: [{ scale: withSpring(dragging.value ? 1.08 : 1) }],
    opacity: dragging.value ? 0.9 : 1,
    zIndex: dragging.value ? 9999 : placement.z,
    // 웹: 텍스트 선택/이미지 드래그가 포인터를 가로채 팬이 취소되는 것 방지.
    userSelect: 'none',
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${item.name} 옮기기`}
        accessibilityHint="끌어서 옮기고, 방 밖으로 끌면 빼요"
        style={animStyle}>
        {/* 자식(이미지·이름표)이 이벤트 타깃이 되지 않게 — 제스처는 래퍼가 받는다. */}
        <View pointerEvents="none" style={styles.fill}>
          <FurniturePlaceholder item={item} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
