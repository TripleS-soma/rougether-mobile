export type Rect = { x: number; y: number; width: number; height: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

export type E2eDevice = {
  name: 'phone' | 'duo-folded' | 'duo-open' | 'desktop';
  viewport: { width: number; height: number };
  touch: boolean;
  /**
   * 시스템이 알려 주는 안전 영역 인셋 — 테스트가 브라우저에 주입한다(`env(safe-area-inset-*)`).
   * Duo 값은 iOS 27.2 시뮬레이터에서 잰 `window.safeAreaInsets`(접힘·펼침 모두 top 0,
   * bottom 34, right 84 — 오른쪽 위 시스템 표시 영역이 오른쪽 전체 높이의 인셋으로 나온다).
   */
  insets: Insets;
  /** 안전 영역 밖의 띠 — 조작 요소가 겹치면 안 된다. 뷰포트 좌표. `insets`에서 계산한다. */
  obstructions: Rect[];
};

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const DUO_INSETS: Insets = { top: 0, right: 84, bottom: 34, left: 0 };

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
): E2eDevice {
  return { name, viewport, touch, insets, obstructions: unsafeZones(viewport, insets) };
}

export const DEVICES: Record<E2eDevice['name'], E2eDevice> = {
  phone: device('phone', { width: 402, height: 874 }, true, NO_INSETS),
  'duo-folded': device('duo-folded', { width: 466, height: 678 }, true, DUO_INSETS),
  'duo-open': device('duo-open', { width: 951, height: 669 }, true, DUO_INSETS),
  desktop: device('desktop', { width: 1280, height: 800 }, false, NO_INSETS),
};
