import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHydrated } from '@/hooks/use-hydrated';
import { useTouchPrimary } from '@/hooks/use-touch-primary';

/**
 * 앱 프레임 폭 — 화면은 전부 폰 기준으로 설계됐으므로 그보다 넓은 창에서는 이 폭의
 * 중앙 컬럼 안에서 그린다(#1215 후속, 웹앱 데스크톱 1단계). 방 캔버스·시트·탭바가
 * 창 폭만큼 늘어나는 대신 폰과 같은 비례를 유지한다.
 *
 * 네이티브도 같다(2026-11-15 제보 "갤럭시 폴드에서 비율이 안 맞는다"). 폴드를 펴면 창이
 * 약 700~750dp, 태블릿은 800dp 이상인데 방은 폭을 따라 정사각으로 커져 화면을 다 덮고
 * 할 일 목록이 밖으로 밀렸다. 폰은 가장 넓어도 450dp 안쪽이라 이 값에 걸리지 않는다.
 */
export const APP_FRAME_MAX_WIDTH = 480;
/**
 * 2단 레이아웃(#1230) — 창이 이 폭 이상이면 방·달력 탭을 [캔버스/달력 | 할 일]
 * 두 칸으로 벌리고, 프레임을 `SPLIT_FRAME_MAX_WIDTH`까지 넓힌다. 그보다 좁으면
 * 폰 컬럼(480) 그대로. 노트북 반분할(~700)은 폰 컬럼, 전체 화면은 2단.
 */
export const SPLIT_MIN_WINDOW_WIDTH = 960;
export const SPLIT_FRAME_MAX_WIDTH = 1200;
/**
 * 터치 기기(네이티브, 터치가 주 입력인 모바일 웹)의 2단 기준 — 펼친 폴더블·태블릿. 두 칸을
 * 1:1로 나눠 칸 하나가 320 이상 나오는 폭부터다. 폰은 가장 넓어도 450 안쪽이라 걸리지 않는다.
 * 마우스 웹과 달리 최대 폭 없이 창을 다 쓴다(`splitFill`) — 양옆을 비우지 않는다.
 */
export const TOUCH_SPLIT_MIN_WIDTH = 640;
/**
 * 왼쪽 세로 탭 줄 기준 — 2단이면서 배치 폭이 이 값 이상이면 아래 탭 바 대신 왼쪽 줄을 둔다.
 * 그보다 좁은 2단(칸 하나 320~419)은 줄이 칸을 더 좁히므로 아래 탭 바를 유지한다.
 * 마우스 웹의 2단은 960부터라 항상 켜진다.
 */
export const NAV_RAIL_MIN_WIDTH = 840;
/**
 * 2단 창에서 바텀시트(Modal) 카드의 최대 폭 (#1367) — 폰 컬럼(480)에 갇히면 넓은
 * 창에서 작성 시트가 좁고 왜소하다. 창 전체를 채우진 않되 폰보다 한 단계 넓힌다.
 * 폰 컬럼(480~959)에서는 앱 컬럼과 같은 480.
 */
export const SHEET_FRAME_MAX_WIDTH = 640;

export type AppFrame = ReturnType<typeof useWindowDimensions> & {
  /** 프레임이 창보다 좁아 중앙 컬럼으로 그리는 중인가(웹 데스크톱·폴드 펼침·태블릿). */
  framed: boolean;
  /**
   * 2단 레이아웃인가 — 마우스 웹은 창이 `SPLIT_MIN_WINDOW_WIDTH` 이상, 터치 기기는
   * `TOUCH_SPLIT_MIN_WIDTH` 이상.
   */
  split: boolean;
  /**
   * 2단이 창 폭을 다 쓰는가(터치 기기) — true일 때만 실린다. 두 칸을 1:1로 벌려 양옆 여백이 없다.
   * 마우스 웹의 2단은 폰 컬럼 + 목록 블록을 가운데 모으는 배치라 해당 없다.
   */
  splitFill?: boolean;
  /** 탭 바를 왼쪽 세로 줄로 두는가 — true일 때만 실린다(터치 기기의 2단 + `NAV_RAIL_MIN_WIDTH` 이상). 마우스 웹은 항상 아래. */
  navRail?: boolean;
  /**
   * 가로 안전 영역 인셋 — 0이 아닐 때만 실린다. 접힌 아이폰 Duo는 오른쪽 84pt가 시스템 표시
   * 영역이다(iOS 27.2 실측 — 펼치면 가로 인셋은 0이고 위 82로 바뀐다). `width`는 이미 이만큼 빠진 값이고, 프레임
   * (`AppFrame`·`ModalFrame`)이 같은 값으로 양옆을 비운다.
   */
  insetLeft?: number;
  insetRight?: number;
};

/** 가로 안전 영역 인셋. */
export type InsetX = { left: number; right: number };
const NO_INSET_X: InsetX = { left: 0, right: 0 };

/**
 * 순수 계산 — 훅 밖에서 테스트한다.
 * @param hydrated false면 무조건 프레임 없음(창 폭 그대로). 웹 정적 export의 서버
 *   렌더는 창 폭을 모르고, 클라이언트 첫 렌더가 서버 마크업과 다르면 React가
 *   className 차이를 고치지 않아 프레임 클래스가 영영 안 붙었다(app.rougether.com
 *   실측 2026-09-09: props는 maxWidth 1200인데 DOM은 폭 100%). 마운트 뒤 두 번째
 *   렌더에서 바뀌면 정상 갱신된다.
 * @param touch 터치가 주 입력인가 — 네이티브는 항상 true, 웹은 `(pointer: coarse)`.
 */
export function resolveAppFrame(
  os: string,
  window: ReturnType<typeof useWindowDimensions>,
  hydrated = true,
  insetX: InsetX = NO_INSET_X,
  touch: boolean = os !== 'web',
): AppFrame {
  // 서버 렌더·첫 렌더는 창 그대로(마크업 일치) — 인셋도 마운트 뒤에 반영한다.
  if (!hydrated) return { ...window, framed: false, split: false };
  const hasInset = insetX.left > 0 || insetX.right > 0;
  const inset = hasInset ? { insetLeft: insetX.left, insetRight: insetX.right } : null;
  // 배치에 쓸 수 있는 폭 — 프레임·2단 판정도 이 폭으로 한다.
  const usable = window.width - insetX.left - insetX.right;
  const framed = usable > APP_FRAME_MAX_WIDTH;
  if (!framed) return { ...window, width: usable, framed, split: false, ...inset };
  // 터치 기기(펼친 폴더블·태블릿)는 창을 다 쓰는 2단 — 네이티브는 항상 터치로 본다.
  if (touch || os !== 'web') {
    const rail = usable >= NAV_RAIL_MIN_WIDTH ? { navRail: true } : null;
    return usable >= TOUCH_SPLIT_MIN_WIDTH
      ? { ...window, width: usable, framed, split: true, splitFill: true, ...rail, ...inset }
      : { ...window, width: APP_FRAME_MAX_WIDTH, framed, split: false, ...inset };
  }
  // 마우스 웹의 2단은 넓은 모니터를 전제로 한 가운데 블록 배치다.
  const split = usable >= SPLIT_MIN_WINDOW_WIDTH;
  const width = split ? Math.min(usable, SPLIT_FRAME_MAX_WIDTH) : APP_FRAME_MAX_WIDTH;
  // 탭 바는 아래에 둔다 — 세로 줄은 터치 기기(펼친 폴더블)에서만 쓴다(2026-11-25 결정).
  return { ...window, width, framed, split, ...inset };
}

/**
 * `useWindowDimensions`의 프레임 인지 버전. 폰 폭 창에서는 창 크기 그대로, 넓은
 * 창에서는 `width`만 프레임 폭(폰 컬럼 480 또는 웹 2단 최대 1200)으로 바뀐다. 폭으로 레이아웃을 계산하는 곳(탭바·온보딩 카드·화면 전환 슬라이드)은
 * 이 훅을 쓴다.
 */
export function useAppFrame(): AppFrame {
  const window = useWindowDimensions();
  // 서버 렌더·클라이언트 첫 렌더는 프레임 없이(마크업 일치), 마운트 뒤에 프레임.
  const hydrated = useHydrated();
  const { left, right } = useSafeAreaInsets();
  const touch = useTouchPrimary();
  return resolveAppFrame(Platform.OS, window, hydrated, { left, right }, touch);
}
