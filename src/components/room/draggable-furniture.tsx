import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { Icon } from '@/components/ui/icon';
import { ROOM_RENDER_CONTRACT } from '@/components/room/room-render-contract';
import { useTokens } from '@/hooks/use-tokens';
import type { FurnitureItem, PlacedFurniture } from '@/resources/furniture';

/** 크기 조절 클램프 (#333) — 서버 제약은 없지만 방을 벗어나지 않는 선. */
export const SCALE_MIN = ROOM_RENDER_CONTRACT.furniture.editorScale.min;
export const SCALE_MAX = ROOM_RENDER_CONTRACT.furniture.editorScale.max;
/** 드래그 중심 좌표 클램프의 기본값(스케일 1) (#333). */
const FREE_ITEM_WIDTH = ROOM_RENDER_CONTRACT.furniture.baseWidth;

/**
 * 터치 영역 비율 (#768) — 가구 박스는 정사각형인데 아트는 대개 그 안을 다
 * 채우지 않는다. 박스 전체가 터치를 먹으면 위에 놓인 가구의 **투명한 모서리**가
 * 아래 가구를 가려, 눈에 보이는 것과 다른 물건이 잡힌다. 안쪽 78%만 받는다.
 */
const HITBOX_RATIO = 0.78;
/**
 * 수축 후에도 이만큼(px)은 남긴다. 최소 축척(0.5)에서 78%면 40px 아래로
 * 떨어져 작은 소품을 아예 못 집게 되기 때문 — 44pt 권장치를 지킨다.
 */
const MIN_HIT_SIZE = 44;

/** 박스 한 변(px)에 대해 각 변에서 깎아낼 양 — 음수 hitSlop으로 쓴다. */
export function hitSlopInset(boxSize: number): number {
  const target = Math.max(MIN_HIT_SIZE, boxSize * HITBOX_RATIO);
  return Math.max(0, (boxSize - target) / 2);
}
export const dragClampBounds = (scale = 1) => {
  'worklet';
  const clampedScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
  const min = (FREE_ITEM_WIDTH * clampedScale) / 2;
  return { min, max: 1 - min };
};

export type DraggableFurnitureProps = {
  item: FurnitureItem;
  placement: PlacedFurniture;
  /** 방 렌더 영역 크기(px) — 좌표 정규화의 기준. */
  roomSize: { w: number; h: number };
  /** 선택됨 — 링 + 크기 핸들 표시 (#333). */
  selected?: boolean;
  /** 짧은 탭 = 선택 (#333). */
  onSelect?: (furnitureId: string) => void;
  /** 미보유 프리뷰 (#501) — 반투명 + 가격 배지로 그린다. */
  preview?: boolean;
  /** 프리뷰 배지에 표시할 다이아 가격 (#501). */
  previewPrice?: number;
  /**
   * 드래그 종료 — 정규화 중심 좌표(방 안으로 클램프됨). 호출측이 좌표를
   * 커밋한다(z 최상위 승격 포함). 빼기는 툴바 버튼으로만 (#333).
   */
  onDragEnd: (furnitureId: string, x: number, y: number) => void;
  /** 핀치/핸들 종료 — 스케일 커밋 (호출측이 SCALE_MIN~MAX로 클램프). */
  onScaleEnd?: (furnitureId: string, scale: number) => void;
  /**
   * 부모 소유의 "드래그 중" 미러 (#608) — 팬 워클릿이 UI 스레드에서만 쓴다.
   * 선택 툴바 숨김처럼 드래그에 반응해야 하는 오버레이가 Animated 스타일로
   * 구독한다. React 상태로 올리면 리렌더가 활성 팬을 취소하므로 SV 전용.
   */
  dragActiveSV?: SharedValue<boolean>;
};

/**
 * 꾸미기 캔버스의 드래그 가능한 가구 (#327/#333, RNGH + Reanimated). 이동·크기는
 * UI 스레드의 shared value로 움직이고, 놓는 순간에만 JS로 커밋한다. 회전·반전은
 * 툴바(React 상태)로만 바뀐다 — 제스처 중 리렌더가 없어야 팬이 살아남는다.
 */
export function DraggableFurniture({
  item,
  placement,
  roomSize,
  selected = false,
  onSelect,
  onDragEnd,
  onScaleEnd,
  dragActiveSV,
  preview = false,
  previewPrice,
}: DraggableFurnitureProps) {
  const t = useTokens();
  const cx = useSharedValue(placement.x * roomSize.w);
  const cy = useSharedValue(placement.y * roomSize.h);
  const scaleSV = useSharedValue(placement.scale ?? 1);
  const start = useSharedValue({ x: 0, y: 0 });
  const baseScale = useSharedValue(1);
  const dragging = useSharedValue(false);

  // 부모 상태(좌표·스케일 커밋, 재로드)와 방 크기 변화를 따라간다.
  useEffect(() => {
    cx.value = placement.x * roomSize.w;
    cy.value = placement.y * roomSize.h;
  }, [placement.x, placement.y, roomSize.w, roomSize.h, cx, cy]);
  useEffect(() => {
    scaleSV.value = placement.scale ?? 1;
  }, [placement.scale, scaleSV]);

  const commitScale = (value: number) => onScaleEnd?.(placement.furnitureId, value);
  const select = () => onSelect?.(placement.furnitureId);

  const itemW = roomSize.w * FREE_ITEM_WIDTH;
  // 음수 hitSlop = 터치 영역 수축 (#768). 변환(scale) 이전 좌표계라 확대·축소
  // 어디서든 같은 비율로 줄어든다.
  const shrink = -hitSlopInset(itemW);

  // 주의: 드래그 중에는 React 상태를 건드리지 않는다 — 리렌더가 제스처를
  // 재생성해 활성 팬을 취소시킨다. z 승격·선택은 제스처 종료에서 처리.
  const pan = Gesture.Pan()
    .withTestId(`item-pan-${placement.furnitureId}`)
    // 선택된 것만 움직인다 (#768) — 예전엔 모든 가구가 팬을 갖고 있어, 고른
    // 것과 무관하게 손가락 아래 z가 높은 가구가 끌려갔다. 선택 안 된 가구는
    // 탭(선택)만 받는다.
    .enabled(selected)
    .hitSlop(shrink)
    .onStart(() => {
      dragging.value = true;
      if (dragActiveSV) dragActiveSV.value = true;
      start.value = { x: cx.value, y: cy.value };
    })
    .onUpdate((e) => {
      // 실제 렌더 크기(기본 박스 × scale)까지 방 안에 남게 한다 (#333).
      const clamp = dragClampBounds(scaleSV.value);
      cx.value = Math.min(
        clamp.max * roomSize.w,
        Math.max(clamp.min * roomSize.w, start.value.x + e.translationX),
      );
      cy.value = Math.min(
        clamp.max * roomSize.h,
        Math.max(clamp.min * roomSize.h, start.value.y + e.translationY),
      );
    })
    .onEnd(() => {
      dragging.value = false;
      runOnJS(onDragEnd)(placement.furnitureId, cx.value / roomSize.w, cy.value / roomSize.h);
    })
    .onFinalize(() => {
      // 취소·중단 경로 포함 항상 해제 — 툴바가 숨은 채 남지 않게.
      dragging.value = false;
      if (dragActiveSV) dragActiveSV.value = false;
    });

  // 짧은 탭 = 선택 (#333). 팬이 활성화되면(=진짜 드래그) 탭은 무산된다.
  const tap = Gesture.Tap()
    .withTestId(`item-tap-${placement.furnitureId}`)
    .hitSlop(shrink)
    .onEnd((_e, success) => {
      if (success) runOnJS(select)();
    });

  // 핀치 크기 조절 (#333) — 어디서든 두 손가락으로.
  const pinch = Gesture.Pinch()
    .withTestId(`item-pinch-${placement.furnitureId}`)
    // 크기 조절도 선택된 것만 (#768) — 드래그와 같은 이유로, 겹친 이웃이
    // 의도치 않게 커지지 않게 한다.
    .enabled(selected)
    .hitSlop(shrink)
    .onStart(() => {
      baseScale.value = scaleSV.value;
    })
    .onUpdate((e) => {
      // 라이브 클램프 (#654) — 상한·하한에서 즉시 멈춰, 손을 뗄 때
      // commitScale이 되돌리는 스냅백이 보이지 않게 한다.
      scaleSV.value = Math.min(SCALE_MAX, Math.max(SCALE_MIN, baseScale.value * e.scale));
    })
    .onEnd(() => {
      runOnJS(commitScale)(scaleSV.value);
    });

  // 탭은 팬의 실패만 기다린다 — 핀치까지 기다리면(웹) 마우스 핀치가 영영
  // 실패하지 않아 탭이 무한 대기한다.
  const gesture = Gesture.Simultaneous(Gesture.Exclusive(pan, tap), pinch);

  // 크기 핸들(우하단) 드래그 — 대각선 이동량을 스케일로 환산 (#333).
  const handlePan = Gesture.Pan()
    .withTestId(`item-handle-${placement.furnitureId}`)
    .onStart(() => {
      baseScale.value = scaleSV.value;
    })
    .onUpdate((e) => {
      // 핸들도 핀치와 같은 라이브 클램프 (#654).
      scaleSV.value = Math.min(
        SCALE_MAX,
        Math.max(SCALE_MIN, baseScale.value + (e.translationX + e.translationY) / itemW),
      );
    })
    .onEnd(() => {
      runOnJS(commitScale)(scaleSV.value);
    });

  const animStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: cx.value - itemW / 2,
    top: cy.value - itemW / 2,
    width: itemW,
    height: itemW,
    // 스케일(핀치/핸들 실시간) × 드는 동안 살짝 확대 피드백. 회전·반전은
    // React 상태에서 온다(툴바 탭 → 리렌더).
    transform: [
      { scale: withSpring(scaleSV.value * (dragging.value ? 1.06 : 1)) },
      ...(placement.rotationDeg ? [{ rotate: `${placement.rotationDeg}deg` }] : []),
      ...(placement.flipped ? [{ scaleX: -1 }] : []),
    ],
    opacity: dragging.value ? 0.9 : 1,
    zIndex: dragging.value ? 9999 : placement.z,
    // 웹: 텍스트 선택/이미지 드래그가 포인터를 가로채 팬이 취소되는 것 방지.
    userSelect: 'none',
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={preview ? `${item.name} 프리뷰 옮기기` : `${item.name} 옮기기`}
        accessibilityHint="탭해서 선택, 끌어서 이동해요"
        accessibilityState={{ selected }}
        style={animStyle}>
        {/* 자식(이미지·이름표)이 이벤트 타깃이 되지 않게 — 제스처는 래퍼가 받는다. */}
        <View pointerEvents="none" style={[styles.fill, preview && styles.previewFill]}>
          <FurniturePlaceholder item={item} />
        </View>
        {/* 미보유 프리뷰 배지 (#501) — 가격이 항상 보여 '탭하면 구매'를 암시. */}
        {preview && previewPrice != null ? (
          <View
            pointerEvents="none"
            style={[styles.previewBadge, { backgroundColor: t.surface, borderColor: t.border }]}
            testID={`preview-badge-${placement.furnitureId}`}>
            <Icon name="diamond" size={9} color={t.primary} />
            <Text style={[styles.previewBadgeText, { color: t.text }]}>{previewPrice}</Text>
          </View>
        ) : null}
        {selected ? (
          <>
            <View
              pointerEvents="none"
              style={[styles.ring, { borderColor: t.primary }]}
              testID={`selection-ring-${placement.furnitureId}`}
            />
            <GestureDetector gesture={handlePan}>
              <Animated.View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={`${item.name} 크기 조절`}
                hitSlop={10}
                style={[styles.handle, { borderColor: t.primary, backgroundColor: t.surface }]}
              />
            </GestureDetector>
          </>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  previewFill: { opacity: 0.6 },
  previewBadge: {
    position: 'absolute',
    top: -8,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewBadgeText: { fontSize: 12 },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2.5,
    borderRadius: 10,
  },
  handle: {
    position: 'absolute',
    right: -7,
    bottom: -7,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
  },
});
