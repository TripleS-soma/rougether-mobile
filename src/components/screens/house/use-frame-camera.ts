import { useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  camDefault,
  cameraClaimsMove,
  clampCam,
  isCamAway,
  seatMetaOpacityFor,
} from '@/components/screens/house/camera';
import { useConstant, useStableCallback } from '@/hooks/use-stable-value';

/**
 * 집 프레임 카메라 (핀치줌·팬, #290·#665·#669·#776) — 집 화면에서 옮겼다(리팩토링 장부 15번,
 * 동작 그대로). 두 손가락 확대(1×~2.5×), 확대 중 한 손가락 팬. 판정(`cameraClaimsMove`)과
 * 클램프는 `house/camera.ts`의 워클릿. 공유값 `useRef` 앵커(#776)는 그대로 — jest가 렌더마다
 * 새 공유값을 주므로 1회 생성한 제스처 클로저가 다른 객체를 보지 않게.
 * 프레임 크기가 바뀌면 카메라를 기본값으로 되돌리는 `onFrameLayout`도 여기서 준다.
 */
export function useFrameCamera({ draggingSV }: { draggingSV: SharedValue<boolean> }) {
  // 두 손가락으로 확대(1×~2.5×), 확대 상태에서 한 손가락 팬. 확대 중에는
  // 자리 교환 드래그를 끄고(좌표계 어긋남 방지) 탭 방문만 유지한다.
  const [zoomed, setZoomed] = useState(false);
  const zoomedRef = useRef(false);
  const camScale = useRef(useSharedValue(1)).current;
  const camTx = useRef(useSharedValue(0)).current;
  const camTy = useRef(useSharedValue(0)).current;
  /** `zoomed`의 UI 스레드 사본 — cameraClaimsMove가 워클릿에서 읽는다. */
  const zoomedSV = useRef(useSharedValue(false)).current;
  /** clampCam이 워클릿에서 읽을 프레임 크기 — JS쪽 frameSize ref의 사본. */
  const frameSizeSV = useRef(useSharedValue({ w: 0, h: 0 })).current;
  // 확대 = '방 구경 모드' (#665) — 이름/접속 라벨은 카메라와 함께 스케일돼
  // 방을 덮으므로, 배율 1→1.15 구간에서 핀치에 연속 추종하며 사라진다.
  const seatMetaOpacity = useRef(useDerivedValue(() => seatMetaOpacityFor(camScale.value))).current;
  const camStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: camTx.value },
      { translateY: camTy.value },
      { scale: camScale.value },
    ],
  }));

  const frameSize = useRef({ w: 0, h: 0 });
  // 제스처 앵커도 공유값 — 워클릿이 읽고 쓴다.
  const pinchAnchor = useRef(
    useSharedValue({ dist: 0, cx: 0, cy: 0, scale: 1, tx: 0, ty: 0 }),
  ).current;
  const panAnchor = useRef(useSharedValue({ x: 0, y: 0, tx: 0, ty: 0 })).current;
  const camTouchCount = useRef(useSharedValue(0)).current;
  /** 터치 시작점 — PanResponder의 누적 `g.dx/dy`(슬롭 판정)를 대신한다. */
  const camTouchStart = useRef(useSharedValue({ x: 0, y: 0 })).current;
  const camActive = useRef(useSharedValue(false)).current;

  // 카메라 상수·판정·클램프 수학은 house/camera.ts로 이동 (#693), #776에서 워클릿화.
  const applyZoomed = useStableCallback((away: boolean) => {
    if (away !== zoomedRef.current) {
      zoomedRef.current = away;
      setZoomed(away);
    }
  });
  /** JS에서 카메라를 스프링으로 옮긴다 — ⟲ 리셋과 놓을 때의 1× 스냅. */
  const animateCamTo = (scale: number, tx: number, ty: number) => {
    const c = clampCam(frameSize.current, scale, tx, ty);
    camScale.value = withSpring(c.scale, { damping: 15, stiffness: 180 });
    camTx.value = withSpring(c.tx, { damping: 15, stiffness: 180 });
    camTy.value = withSpring(c.ty, { damping: 15, stiffness: 180 });
    const away = isCamAway(c);
    zoomedSV.value = away;
    applyZoomed(away);
  };
  const resetCam = () => {
    const d = camDefault();
    animateCamTo(d.scale, d.tx, d.ty);
  };
  // 거의 원배율(축소 조망)이면 딱 1×로 스냅 — 기본(방 뷰) 복귀는 ⟲로.
  const snapCamIfNearDefault = useStableCallback(() => {
    if (camScale.value < 1.05) animateCamTo(1, 0, 0);
  });

  /**
   * 프레임 카메라 제스처 (#776) — PanResponder를 RNGH로 옮기되 **판정은 그대로**
   * 둔다. `cameraClaimsMove`(#669의 CAM_PAN_SLOP=8 포함)를 워클릿으로 그대로
   * 부르므로 손맛과 테스트가 함께 산다.
   *
   * `manualActivation`인 이유: 종전 `onMoveShouldSetPanResponderCapture`는
   * 슬롭을 넘길 때까지 **매 move마다 false를 돌려주다가** 넘는 순간 캡처했다.
   * RNGH에서 `fail()`은 그 터치를 영구히 포기하는 것이라 의미가 다르다 —
   * 아직 아니면 아무것도 안 하고, 조건이 서면 그때 `activate()`한다.
   */
  const cameraGesture = useConstant(() => {
    /**
     * 지금 손가락 배치로 기준점을 다시 잡는다 — 종전 `anchorCamera`(#290).
     * 세 시점에서 불린다: 터치 시작, **캡처되는 순간**, 손가락 수 변경.
     *
     * 캡처 순간이 특히 중요하다 (PR #1005 리뷰). 한 손가락 팬은 슬롭
     * `CAM_PAN_SLOP=8`을 넘겨야 활성화되는데, 그때 기준점을 다시 안 잡으면
     * 슬롭을 넘느라 이미 움직인 거리가 첫 델타에 통째로 들어가 카메라가
     * 그만큼 튄다. 종전 PanResponder는 `onPanResponderGrant`가 이 일을 했다.
     */
    const anchor = (ts: { absoluteX: number; absoluteY: number }[]) => {
      'worklet';
      camTouchCount.value = ts.length;
      if (ts.length >= 2) {
        const dx = ts[0].absoluteX - ts[1].absoluteX;
        const dy = ts[0].absoluteY - ts[1].absoluteY;
        pinchAnchor.value = {
          dist: Math.hypot(dx, dy),
          cx: (ts[0].absoluteX + ts[1].absoluteX) / 2,
          cy: (ts[0].absoluteY + ts[1].absoluteY) / 2,
          scale: camScale.value,
          tx: camTx.value,
          ty: camTy.value,
        };
      } else if (ts.length === 1) {
        panAnchor.value = {
          x: ts[0].absoluteX,
          y: ts[0].absoluteY,
          tx: camTx.value,
          ty: camTy.value,
        };
      }
    };
    return (
      Gesture.Pan()
        .withTestId('house-camera-pan')
        .manualActivation(true)
        .onTouchesDown((e) => {
          'worklet';
          const ts = e.allTouches;
          if (ts.length > 0) camTouchStart.value = { x: ts[0].absoluteX, y: ts[0].absoluteY };
          anchor(ts);
        })
        .onTouchesMove((e, mgr) => {
          'worklet';
          const ts = e.allTouches;
          if (ts.length === 0) return;
          if (!camActive.value) {
            const dx = ts[0].absoluteX - camTouchStart.value.x;
            const dy = ts[0].absoluteY - camTouchStart.value.y;
            if (cameraClaimsMove(ts.length, zoomedSV.value, draggingSV.value, dx, dy)) {
              camActive.value = true;
              // 캡처된 지금 위치를 기준으로 — 슬롭만큼의 점프를 없앤다.
              anchor(ts);
              mgr.activate();
            }
            return;
          }
          // 손가락 수가 바뀌면(2→1, 1→2) 기준점을 다시 잡는다.
          if (ts.length !== camTouchCount.value) {
            anchor(ts);
            return;
          }
          let next;
          if (ts.length >= 2) {
            const a = pinchAnchor.value;
            if (a.dist === 0) return;
            const dx = ts[0].absoluteX - ts[1].absoluteX;
            const dy = ts[0].absoluteY - ts[1].absoluteY;
            const cx = (ts[0].absoluteX + ts[1].absoluteX) / 2;
            const cy = (ts[0].absoluteY + ts[1].absoluteY) / 2;
            next = clampCam(
              frameSizeSV.value,
              a.scale * (Math.hypot(dx, dy) / a.dist),
              a.tx + (cx - a.cx),
              a.ty + (cy - a.cy),
            );
          } else if (zoomedSV.value) {
            const a = panAnchor.value;
            next = clampCam(
              frameSizeSV.value,
              camScale.value,
              a.tx + (ts[0].absoluteX - a.x),
              a.ty + (ts[0].absoluteY - a.y),
            );
          } else {
            return;
          }
          camScale.value = next.scale;
          camTx.value = next.tx;
          camTy.value = next.ty;
          const away = isCamAway(next);
          if (away !== zoomedSV.value) {
            zoomedSV.value = away;
            runOnJS(applyZoomed)(away);
          }
        })
        // onFinalize는 **활성화 여부와 무관하게** 항상 불린다 — activate()를 한
        // 번도 안 부른 단순 탭(좌석 방문)에서도 온다. 기본 배율이 1이라
        // snapCamIfNearDefault의 가드(<1.05)가 항상 참이 되어, 탭마다 runOnJS
        // 브리지 + withSpring 3개가 헛돌았다 (PR #1005 리뷰). 종전
        // onPanResponderRelease는 responder가 grant된 경우에만 불렸다.
        .onFinalize(() => {
          'worklet';
          const wasActive = camActive.value;
          camTouchCount.value = 0;
          camActive.value = false;
          if (wasActive) runOnJS(snapCamIfNearDefault)();
        })
    );
  });

  /** 프레임 측정 — 크기가 바뀌면(정원 변경·폴백·리사이즈) 이전 카메라는 무효. */
  const onFrameLayout = (e: LayoutChangeEvent) => {
    const changed =
      Math.abs(frameSize.current.w - e.nativeEvent.layout.width) > 1 ||
      Math.abs(frameSize.current.h - e.nativeEvent.layout.height) > 1;
    frameSize.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
    // clampCam이 워클릿에서 읽는 사본 (#776).
    frameSizeSV.value = frameSize.current;
    // Capacity changes, fallback and resizing invalidate the old camera.
    if (changed) {
      const d = camDefault();
      camScale.value = d.scale;
      camTx.value = d.tx;
      camTy.value = d.ty;
      zoomedSV.value = false;
      applyZoomed(false);
    }
  };

  return { zoomed, camStyle, seatMetaOpacity, cameraGesture, resetCam, onFrameLayout };
}
