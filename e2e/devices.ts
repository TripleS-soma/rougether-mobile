export type Rect = { x: number; y: number; width: number; height: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

export type E2eDevice = {
  name: 'phone' | 'duo-folded' | 'duo-open' | 'fold8-cover' | 'fold8-open' | 'desktop';
  /**
   * 화면의 꼴 — 테스트는 기기 이름이 아니라 이것으로 대상을 고른다. `folded`는 접힌 폴더블의
   * 넓고 짧은 화면, `open`은 펼친 폴더블의 2단 화면.
   */
  posture: 'phone' | 'folded' | 'open' | 'desktop';
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
 * 폭(82)으로 오지만 묶음은 오른쪽 끝에만 있고(캡처 실측: x 880~925pt), 와이파이 그림의 아래 끝은
 * 시스템 인셋보다 낮은 98pt쯤까지 내려온다. 접힌 화면의 띠 폭(84)과 같은 폭의 모서리 칸으로 잡는다.
 * 앱은 2단의 오른쪽 칸 머리를 인셋보다 16 더 내려 이 칸을 피한다(`useSplitRightPaneInsets`).
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
  posture: E2eDevice['posture'],
  viewport: E2eDevice['viewport'],
  touch: boolean,
  insets: Insets,
  obstructions: Rect[] = unsafeZones(viewport, insets),
): E2eDevice {
  return { name, posture, viewport, touch, insets, obstructions };
}

/**
 * 갤럭시 Z 폴드8 — **추정값이다. 실기기·에뮬레이터로 재지 않았다.**
 *
 * 알려진 것은 픽셀 크기뿐이다(커버 1248×1972, 펼침 2448×1848 — 제조사 공개 사양). dp는 화면
 * 밀도에 달렸는데 밀도를 모른다. 삼성 폴드 계열의 기본 밀도 배율 2.625(420dpi 묶음)를 가정해
 * 나눴다: 커버 475×751, 펼침 **704×932**. 사용자가 화면 확대/축소 설정을 바꾸면 이 값도 달라진다.
 *
 * 펼친 화면은 세로로 잡는다 — 앱이 세로 고정이라, 같은 픽셀 크기와 밀도를 준 안드로이드
 * 에뮬레이터가 2448×1848 화면을 1848×2448(704×932dp)로 돌려 앱에 줬다(2026-11-23 확인).
 * 그래서 폭이 세로 탭 줄 기준(840)에 못 미쳐 "좁은 두 칸 + 아래 탭 바"가 된다.
 * 안전 영역도 추정이다(가장자리까지 그리는 안드로이드의 상태 표시줄 32, 제스처 줄 24).
 *
 * 실측하면 이 값과 주석을 바꾼다. 그때까지 이 두 프로젝트는 "이 크기 언저리에서 배치 규칙이
 * 깨지지 않는다"만 말해 준다.
 */
const FOLD8_DENSITY = 2.625;
const FOLD8_INSETS: Insets = { top: 32, right: 0, bottom: 24, left: 0 };
const fold8 = (px: { width: number; height: number }) => ({
  width: Math.round(px.width / FOLD8_DENSITY),
  height: Math.round(px.height / FOLD8_DENSITY),
});

const DUO_OPEN_VIEWPORT = { width: 951, height: 669 };

export const DEVICES: Record<E2eDevice['name'], E2eDevice> = {
  phone: device('phone', 'phone', { width: 402, height: 874 }, true, NO_INSETS),
  'duo-folded': device(
    'duo-folded',
    'folded',
    { width: 466, height: 678 },
    true,
    DUO_FOLDED_INSETS,
  ),
  // 가려지는 곳은 인셋의 위쪽 띠 전체가 아니라 오른쪽 위 모서리 칸 + 아래 띠.
  'duo-open': device('duo-open', 'open', DUO_OPEN_VIEWPORT, true, DUO_OPEN_INSETS, [
    {
      x: DUO_OPEN_VIEWPORT.width - DUO_OPEN_CORNER.width,
      y: 0,
      ...DUO_OPEN_CORNER,
    },
    ...unsafeZones(DUO_OPEN_VIEWPORT, { ...DUO_OPEN_INSETS, top: 0 }),
  ]),
  'fold8-cover': device(
    'fold8-cover',
    'folded',
    fold8({ width: 1248, height: 1972 }),
    true,
    FOLD8_INSETS,
  ),
  'fold8-open': device(
    'fold8-open',
    'open',
    fold8({ width: 1848, height: 2448 }),
    true,
    FOLD8_INSETS,
  ),
  desktop: device('desktop', 'desktop', { width: 1280, height: 800 }, false, NO_INSETS),
};

/** 세로 탭 줄 기준 — 앱의 `NAV_RAIL_MIN_WIDTH`와 같은 값. */
const NAV_RAIL_MIN_WIDTH = 840;

/**
 * 이 기기에서 탭 바가 왼쪽 세로 줄인가(아니면 아래에 떠 있는 알약). 2단이면서 배치 폭이 840
 * 이상인 터치 기기일 때다 — 펼친 아이폰 Duo는 세로 줄, 세로로 펼친 폴드8(704)과 데스크톱 웹(마우스)은 아래 알약.
 */
export function hasNavRail(device: E2eDevice): boolean {
  const usable = device.viewport.width - device.insets.left - device.insets.right;
  return device.posture === 'open' && usable >= NAV_RAIL_MIN_WIDTH;
}
