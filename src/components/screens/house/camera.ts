// 프레임 카메라(핀치줌·팬, #290 #307 #669)의 순수 로직 — house-screen.tsx에서
// 분리 (#693). 애니메이션·responder 배선은 화면이 갖고, 상수·판정·수학만 둔다.

export const CAM_MAX_SCALE = 3;
// 방 더블탭 줌 — 창문(폭 35%)이 카메라 뷰포트를 거의 가득 채우는 배율.
export const CAM_ROOM_SCALE = 2.9;
// 이 간격 안의 두 번째 탭 = 더블탭(줌). 한 번 탭(방문)은 이만큼 기다렸다 실행.
export const DOUBLE_TAP_MS = 260;
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
  if (draggingSeat) return false;
  if (touchCount >= 2) return true;
  return zoomed && Math.hypot(dx, dy) > CAM_PAN_SLOP;
}

// 기본 카메라 = 집 전체(원배율) — 확대(1.3)는 프레임을 좌우로 잘라내서
// 기본에서는 쓰지 않는다. 방 클로즈업은 더블탭/핀치로만 진입한다.
export const camDefault = (): CameraState => ({ scale: 1, tx: 0, ty: 0 });

export const clampCam = (
  frame: { w: number; h: number },
  scale: number,
  tx: number,
  ty: number,
): CameraState => {
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

// ⟲ 리셋·팬·드래그 게이트는 "기본 프리셋에서 벗어났는가"로 판단한다.
export const isCamAway = (c: CameraState) => {
  const d = camDefault();
  return (
    Math.abs(c.scale - d.scale) > 0.04 || Math.abs(c.tx - d.tx) > 6 || Math.abs(c.ty - d.ty) > 6
  );
};
