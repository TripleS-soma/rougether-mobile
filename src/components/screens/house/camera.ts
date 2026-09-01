// 프레임 카메라(핀치줌·팬, #290 #307 #669)의 순수 로직 — house-screen.tsx에서
// 분리 (#693). 애니메이션·제스처 배선은 화면이 갖고, 상수·판정·수학만 둔다.
//
// 전부 `'worklet'`이다 (#776) — RNGH 제스처 콜백(UI 스레드)에서 불린다.
// 지시자가 없으면 웹/jest(전부 JS 스레드)에선 멀쩡하다가 **네이티브에서만**
// Reanimated 치명 오류로 앱이 종료된다(tab-pager의 settleTarget과 같은 규칙).
// JS에서도 그대로 호출 가능하므로 기존 테스트는 손대지 않는다.

export const CAM_MAX_SCALE = 3;
// 확대 중 한 손가락 팬 캡처 전 허용 이동량 (#669) — 실기기 탭은 1~2px
// 지터가 있어, 이동량 조건 없이 캡처하면 방 탭(방문)이 전부 취소된다.
export const CAM_PAN_SLOP = 8;

export type CameraState = { scale: number; tx: number; ty: number };

/**
 * 카메라가 이 move에서 터치를 가져갈지 (#669) — 두 손가락(핀치)은 즉시,
 * 확대 중 한 손가락은 탭 지터를 넘는 실제 팬일 때만. 자리 드래그 중엔 양보.
 */
export function cameraClaimsMove(
  touchCount: number,
  zoomed: boolean,
  draggingSeat: boolean,
  dx: number,
  dy: number,
): boolean {
  'worklet';
  if (draggingSeat) return false;
  if (touchCount >= 2) return true;
  return zoomed && Math.hypot(dx, dy) > CAM_PAN_SLOP;
}

// 기본 카메라 = 집 전체(원배율) — 확대(1.3)는 프레임을 좌우로 잘라내서
// 기본에서는 쓰지 않는다. 방 클로즈업은 더블탭/핀치로만 진입한다.
export const camDefault = (): CameraState => {
  'worklet';
  return { scale: 1, tx: 0, ty: 0 };
};

export const clampCam = (
  frame: { w: number; h: number },
  scale: number,
  tx: number,
  ty: number,
): CameraState => {
  'worklet';
  const { w, h } = frame;
  const s = Math.min(CAM_MAX_SCALE, Math.max(1, scale));
  // 팬은 프레임 경계까지 — translate는 스케일 바깥(화면 px) 기준.
  const maxTx = ((s - 1) * w) / 2;
  const maxTy = ((s - 1) * h) / 2;
  return {
    scale: s,
    tx: Math.min(maxTx, Math.max(-maxTx, tx)),
    ty: Math.min(maxTy, Math.max(-maxTy, ty)),
  };
};

/**
 * 확대 = '방 구경 모드' (#665) — 좌석 이름표는 카메라와 함께 커져 방을 덮으므로
 * 배율 1 → 이 값 구간에서 핀치에 연속 추종하며 사라진다.
 */
export const CAM_META_FADE_END = 1.15;

/**
 * 배율 → 좌석 이름표 오파시티 (#776에서 화면 밖으로 분리). 종전엔 화면 안에서
 * `camScale.interpolate(...)`로 만들어 값 자체를 테스트할 방법이 없었고,
 * Reanimated의 jest mock은 `useAnimatedStyle`을 평가하지 않아 더욱 그렇다.
 * 곡선을 순수 함수로 두면 여기서 직접 단언할 수 있다.
 */
export function seatMetaOpacityFor(scale: number): number {
  'worklet';
  const t = (scale - 1) / (CAM_META_FADE_END - 1);
  return 1 - Math.min(1, Math.max(0, t));
}

// ⟲ 리셋·팬·드래그 게이트는 "기본 프리셋에서 벗어났는가"로 판단한다.
export const isCamAway = (c: CameraState) => {
  'worklet';
  const d = camDefault();
  return (
    Math.abs(c.scale - d.scale) > 0.04 || Math.abs(c.tx - d.tx) > 6 || Math.abs(c.ty - d.ty) > 6
  );
};
