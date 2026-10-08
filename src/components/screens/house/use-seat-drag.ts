import { useRef, useState } from 'react';
import type { View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, withSpring } from 'react-native-reanimated';

import { type SeatRect, seatAtPoint } from '@/components/screens/house/seat-drag';
import { useConstant, useLatestRef, useStableCallback } from '@/hooks/use-stable-value';
import { hapticSelection, hapticSuccess } from '@/utils/haptics';

/**
 * 집 좌석 타일 드래그 앤 드롭 (자리 맞바꾸기, #278·#450·#776) — 집 화면에서 옮겼다(리팩토링
 * 장부 15번, 동작 그대로). 공유값의 `useRef` 앵커(#776)와 제스처 팩토리 두 벌(프레임 격자·
 * 평면 격자 — 같은 제스처 객체를 두 GestureDetector에 못 쓴다)은 장부 '건드리지 말 것'
 * 그대로다. 실제 자리 교환(서버 또는 데모 순열)은 화면이 `swapSeats`로 넘긴다.
 */
export function useSeatDrag({ swapSeats }: { swapSeats: (from: number, to: number) => void }) {
  // Long-press lifts a tile, the grid captures the active touch and the tile
  // follows the finger; releasing over another seat swaps the two. Seat rects
  // are measured (window coords) at lift time, so drops hit-test directly
  // against gestureState.moveX/Y.
  const [dragSeat, setDragSeat] = useState<number | null>(null);
  const dragSeatRef = useRef<number | null>(null);
  const dragGranted = useRef(false);
  // 공유값은 첫 렌더 인스턴스에 앵커링 (#776) — 프로덕션 useSharedValue는
  // 참조가 안정적이지만 jest는 렌더마다 새 객체를 돌려줘, 1회 생성한 제스처의
  // 클로저와 최신 쓰기가 서로 다른 객체를 보게 된다 (tab-pager와 같은 이유).
  const dragPan = useRef(useSharedValue({ x: 0, y: 0 })).current;
  const tileRefs = useRef(new Map<number, View>());
  const tileRects = useRef(new Map<number, SeatRect>());

  // 픽업 순간 스프링으로 살짝 떠오르는 리프트 (#450).
  const liftScale = useRef(useSharedValue(1)).current;
  /** 카메라 워클릿이 "자리 드래그 중인가"를 읽는 창구 — dragSeatRef의 UI 스레드 사본. */
  const draggingSV = useRef(useSharedValue(false)).current;
  const startDrag = (seat: number) => {
    hapticSelection();
    liftScale.value = 1;
    // friction 4 / tension 220 → Reanimated 환산 (damping/stiffness).
    liftScale.value = withSpring(1.07, { damping: 4, stiffness: 220, mass: 1 });
    draggingSV.value = true;
    tileRects.current.clear();
    tileRefs.current.forEach((ref, idx) =>
      ref.measureInWindow((x, y, w, h) => tileRects.current.set(idx, { x, y, w, h })),
    );
    dragSeatRef.current = seat;
    dragGranted.current = false;
    setDragSeat(seat);
  };
  const endDrag = () => {
    dragSeatRef.current = null;
    dragGranted.current = false;
    draggingSV.value = false;
    dragPan.value = { x: 0, y: 0 };
    // liftScale은 여기서 되돌리지 않는다 — `dragging`이 같은 렌더에서 false가
    // 되어 SeatTile의 liftStyle이 즉시 {}가 되므로 복귀 스프링은 화면에 안
    // 보인다 (PR #1005 리뷰). 다음 픽업의 startDrag가 1로 되돌린다.
    setDragSeat(null);
  };
  const dropAt = (x: number, y: number) => {
    const from = dragSeatRef.current;
    if (from != null) {
      const to = seatAtPoint(tileRects.current, x, y);
      if (to != null && to !== from) {
        hapticSuccess();
        swapSeats(from, to);
      }
    }
    endDrag();
  };
  // The responder is created once — route through a ref so the release sees
  // the current house/permutation, not the mount-time closure.
  const dropAtRef = useLatestRef(dropAt);
  // 워클릿에서 부를 JS 콜백들 — ref.current를 UI 스레드에서 읽을 수 없으므로
  // 참조가 고정된 래퍼를 거친다 (#776).
  const handleDrop = useStableCallback((x: number, y: number) => dropAtRef.current(x, y));
  const handleDragGranted = useStableCallback(() => {
    dragGranted.current = true;
  });
  const handleDragCancel = useStableCallback(() => endDrag());
  /**
   * 자리 드래그 (#776) — 종전엔 PanResponder + `Animated.event`(useNativeDriver
   * false)라 손가락 이동이 매 프레임 JS를 거쳐 타일 transform까지 갔다. 이제
   * 오프셋은 UI 스레드에서만 움직이고, JS는 **놓는 순간 한 번**만 깨운다.
   *
   * 히트테스트는 그대로 JS다 — `measureInWindow`가 비동기라 사각형을 공유값에
   * 복제해야 하는데, 드롭은 프레임당이 아니라 제스처당 1회라 이득이 없다.
   *
   * 같은 제스처 객체를 두 GestureDetector에 못 쓴다(프레임 격자·평면 격자).
   * 팩토리로 두 벌 만들되 공유값·콜백은 같은 것을 닫는다.
   */
  const makeDragGesture = () =>
    Gesture.Pan()
      .manualActivation(true)
      // 롱프레스로 타일이 들리기 전에는 터치를 가져가지 않는다 — fail()이
      // 아니라 '아직 활성화 안 함'이라, 들린 뒤의 이동은 같은 터치에서 잡힌다.
      .onTouchesMove((_e, mgr) => {
        'worklet';
        if (draggingSV.value) mgr.activate();
      })
      .onStart(() => {
        'worklet';
        runOnJS(handleDragGranted)();
      })
      .onUpdate((e) => {
        'worklet';
        dragPan.value = { x: e.translationX, y: e.translationY };
      })
      .onEnd((e) => {
        'worklet';
        runOnJS(handleDrop)(e.absoluteX, e.absoluteY);
      })
      .onFinalize((_e, success) => {
        'worklet';
        if (!success) runOnJS(handleDragCancel)();
      });
  const frameDragGesture = useConstant(makeDragGesture);
  const floorsDragGesture = useConstant(makeDragGesture);
  // A lift with no movement never grants the responder — the tile's pressOut
  // is then the only release signal, so it clears the stuck lift.
  const onTilePressOut = () => {
    if (dragSeatRef.current == null) return;
    setTimeout(() => {
      if (!dragGranted.current) endDrag();
    }, 80);
  };

  return {
    dragSeat,
    dragPan,
    liftScale,
    /** 카메라 워클릿이 "자리 드래그 중인가"를 읽는 창구. */
    draggingSV,
    tileRefs,
    startDrag,
    onTilePressOut,
    frameDragGesture,
    floorsDragGesture,
  };
}
