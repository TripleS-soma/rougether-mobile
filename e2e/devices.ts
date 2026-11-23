export type Rect = { x: number; y: number; width: number; height: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

export type E2eDevice = {
  name: 'phone' | 'duo-folded' | 'duo-open' | 'desktop';
  viewport: { width: number; height: number };
  touch: boolean;
  /**
   * 시스템이 알려 주는 안전 영역 인셋 — 테스트가 브라우저에 주입한다(`env(safe-area-inset-*)`).
   * Duo 값은 iOS 27.2 시뮬레이터에서 앱 화면에 `useSafeAreaInsets()`를 찍어 잰 것이다.
   * 접힘: top 0 · right 84 · bottom 34 (시스템 표시 영역이 오른쪽 전체 높이의 띠).
   * 펼침: **top 82 · right 0 · bottom 34**, 창 951×669 (2026-11-23 실측 — 시스템 표시는 오른쪽 위
   * 모서리에만 있는데 인셋은 위쪽 전체 폭으로 온다. 전에 적었던 "펼침도 right 84"는 틀렸다).
   */
  insets: Insets;
  /** 안전 영역 밖의 띠 — 조작 요소가 겹치면 안 된다. 뷰포트 좌표. `insets`에서 계산한다. */
  obstructions: Rect[];
};

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const DUO_FOLDED_INSETS: Insets = { top: 0, right: 84, bottom: 34, left: 0 };
const DUO_OPEN_INSETS: Insets = { top: 82, right: 0, bottom: 34, left: 0 };
/**
 * 펼친 Duo에서 실제로 가려지는 곳 — 오른쪽 위 모서리의 시계·와이파이 묶음. 인셋은 위쪽 전체
 * 폭(82)으로 오지만 묶음은 오른쪽 끝에만 있다(캡처 실측: x 880~925pt, y 27~98pt). 접힌 화면의
 * 띠 폭(84)과 같은 폭의 모서리 칸으로 잡는다.
 */
const DUO_OPEN_CORNER = { width: 84, height: 98 };

/** 인셋이 0이 아닌 변마다 화면 가장자리 띠 하나. */
function unsafeZones({ width, height }: E2eDevice['viewport'], insets: Insets): Rect[] {
  const zones: Rect[] = [];
  if (insets.top > 0) zones.push({ x: 0, y: 0, width, height: insets.top });
  if (insets.bottom > 0)
    zones.push({ x: 0, y: height - insets.bottom, width, height: insets.bottom });
  if (insets.left > 0) zones.push({ x: 0, y: 0, width: insets.left, height });
  if (insets.right > 0) zones.push({ x: width - insets.right, y: 0, width: insets.right, height });
  return zones;
}

function device(
  name: E2eDevice['name'],
  viewport: E2eDevice['viewport'],
  touch: boolean,
  insets: Insets,
  obstructions: Rect[] = unsafeZones(viewport, insets),
): E2eDevice {
  return { name, viewport, touch, insets, obstructions };
}

const DUO_OPEN_VIEWPORT = { width: 951, height: 669 };

export const DEVICES: Record<E2eDevice['name'], E2eDevice> = {
  phone: device('phone', { width: 402, height: 874 }, true, NO_INSETS),
  'duo-folded': device('duo-folded', { width: 466, height: 678 }, true, DUO_FOLDED_INSETS),
  // 가려지는 곳은 인셋의 위쪽 띠 전체가 아니라 오른쪽 위 모서리 칸 + 아래 띠.
  'duo-open': device('duo-open', DUO_OPEN_VIEWPORT, true, DUO_OPEN_INSETS, [
    {
      x: DUO_OPEN_VIEWPORT.width - DUO_OPEN_CORNER.width,
      y: 0,
      ...DUO_OPEN_CORNER,
    },
    ...unsafeZones(DUO_OPEN_VIEWPORT, { ...DUO_OPEN_INSETS, top: 0 }),
  ]),
  desktop: device('desktop', { width: 1280, height: 800 }, false, NO_INSETS),
};
